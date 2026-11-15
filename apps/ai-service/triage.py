"""
PulseCare AI pre-visit triage.

Takes a patient's structured intake (chief complaint, symptoms, duration, pain,
flags) and returns an advisory urgency + specialty + rationale.

Important safety principle: the backend STILL runs its deterministic red-flag
check on top of whatever this returns and can only UPGRADE urgency, never
downgrade it. This module can safely focus on being thorough + helpful; the
backend owns the never-miss-a-heart-attack guarantee.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import List, Optional

from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate

from llm_factory import get_llm as _factory_get_llm, extract_text

log = logging.getLogger("pulsecare.triage")


# ---------- request / response models ----------

class TriageAssessRequest(BaseModel):
    chief_complaint: str
    symptoms: List[str] = Field(default_factory=list)
    duration_days: int = Field(..., ge=0, le=180)
    pain_level: int = Field(..., ge=0, le=10)
    fever: bool = False
    chest_pain: bool = False
    shortness_of_breath: bool = False


class TriageAssessResult(BaseModel):
    urgency: str  # 'EMERGENCY' | 'URGENT' | 'ROUTINE'
    rationale: str
    suggested_specialty: str
    red_flags: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    confidence: float = Field(0.75, ge=0.0, le=1.0)
    ai_powered: bool = True


# ---------- LLM wiring ----------

def _get_llm():
    # Delegate provider selection to the shared factory. Triage is clinical,
    # not creative, so temperature stays low and 512 tokens is plenty for
    # the compact JSON we expect back.
    return _factory_get_llm(
        temperature=0.1,
        max_tokens=512,
        title="PulseCare Pre-Visit Triage",
    )


# ---------- deterministic fallback (mirrors backend TriageService rules) ----------

_CRITICAL_KEYWORDS = (
    "chest pain", "chest tightness", "shortness of breath",
    "severe bleeding", "unconscious", "stroke", "paralysis",
    "anaphylaxis", "severe burn", "head injury",
)

_SPECIALTY_KEYWORDS = {
    "Cardiology": ("chest", "heart", "cardiac", "palpitation"),
    "Pulmonology": ("cough", "wheezing", "asthma", "breath"),
    "Dermatology": ("rash", "skin", "allergic", "itching"),
    "Neurology": ("headache", "migraine", "numbness", "seizure", "dizziness"),
    "Gastroenterology": ("stomach", "abdominal", "nausea", "vomiting", "diarrhea"),
    "Obstetrics & Gynaecology": ("pregnancy", "obstetric", "menstrual"),
    "Pediatrics": ("child", "pediatric", "infant"),
    "Orthopedics": ("joint", "fracture", "sprain", "back pain"),
}


def _deterministic_assessment(req: TriageAssessRequest) -> TriageAssessResult:
    """Fallback when the LLM is unavailable. Also serves as the safety baseline."""
    symptoms_blob = " ".join([req.chief_complaint] + list(req.symptoms)).lower()

    red_flags: List[str] = []
    if req.chest_pain:
        red_flags.append("Chest pain reported")
    if req.shortness_of_breath:
        red_flags.append("Shortness of breath reported")
    if req.pain_level >= 8:
        red_flags.append(f"Severe pain ({req.pain_level}/10)")
    for kw in _CRITICAL_KEYWORDS:
        if kw in symptoms_blob and kw not in " ".join(red_flags).lower():
            red_flags.append(f"Keyword: {kw}")

    if red_flags:
        urgency = "EMERGENCY"
        rationale = (
            "Critical red-flag indicators detected. Emergency department care "
            "strongly advised; do not wait for a scheduled appointment."
        )
        actions = [
            "Go to the nearest emergency department or call an ambulance now.",
            "Do not drive yourself if symptoms are severe.",
        ]
    elif req.fever or req.pain_level >= 5 or req.duration_days >= 3:
        urgency = "URGENT"
        rationale = (
            "Elevated symptom burden with ongoing systemic indicators. A same-day "
            "clinical assessment is recommended."
        )
        actions = [
            "Book a same-day appointment with a doctor.",
            "Monitor for new red-flag symptoms (chest pain, breathing difficulty).",
        ]
    else:
        urgency = "ROUTINE"
        rationale = (
            "Stable clinical parameters. A standard scheduled clinic or video "
            "telehealth consultation is appropriate."
        )
        actions = [
            "Book a routine appointment at your convenience within the next few days.",
            "Rest, hydrate, and monitor symptoms.",
        ]

    specialty = "General Medicine"
    for spec, keywords in _SPECIALTY_KEYWORDS.items():
        if any(kw in symptoms_blob for kw in keywords):
            specialty = spec
            break
    if urgency == "EMERGENCY" and specialty == "General Medicine":
        specialty = "Emergency & Internal Medicine"

    return TriageAssessResult(
        urgency=urgency,
        rationale=rationale,
        suggested_specialty=specialty,
        red_flags=red_flags,
        recommended_actions=actions,
        confidence=0.70,
        ai_powered=False,
    )


# ---------- prompt + parsing ----------

_SYSTEM_PROMPT = """You are a clinical triage assistant for a patient-facing booking app.
You review a patient's self-reported pre-visit intake and produce ADVISORY
guidance for the booking flow. You are not making a diagnosis.

Output a single JSON object with EXACTLY these keys and nothing else. No prose
outside the JSON. No markdown code fences. No comments.

{{
  "urgency": "EMERGENCY" | "URGENT" | "ROUTINE",
  "rationale": "2-3 sentences, plain language, suitable for the patient to read",
  "suggested_specialty": "e.g. Cardiology, Pulmonology, Dermatology, Neurology, Gastroenterology, Orthopedics, General Medicine, Pediatrics, Obstetrics & Gynaecology, Emergency & Internal Medicine",
  "red_flags": ["short bullet"],
  "recommended_actions": ["short bullet"],
  "confidence": 0.0 to 1.0
}}

Classification rules you MUST follow:
- EMERGENCY: chest pain, respiratory distress, severe pain (>=8/10), neurological
  deficits, severe bleeding, loss of consciousness, anaphylaxis, stroke signs,
  pregnancy complications.
- URGENT: moderate-to-severe pain (5-7/10), fever, symptoms lasting >=3 days,
  worsening symptoms, infection signs.
- ROUTINE: mild symptoms, short duration, no red flags, stable parameters.

For recommended_actions, give 2-4 concrete steps the patient should take right
now (go to ER, book same-day, monitor specific signs, etc). Keep each item
under 20 words.

Never invent symptoms the patient did not report. Never give medication advice.
Never diagnose. If unsure, bias toward the higher urgency category.
"""

_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


def _strip_fence(raw: str) -> str:
    raw = raw.strip()
    match = _JSON_FENCE_RE.match(raw)
    return match.group(1).strip() if match else raw


def _parse_llm_output(raw: str, fallback: TriageAssessResult) -> TriageAssessResult:
    """Parse the model's JSON. On any failure, degrade to the deterministic fallback."""
    try:
        data = json.loads(_strip_fence(raw))
    except (json.JSONDecodeError, ValueError):
        return fallback

    urgency = str(data.get("urgency", "")).upper()
    if urgency not in ("EMERGENCY", "URGENT", "ROUTINE"):
        urgency = fallback.urgency

    def _str_list(key: str) -> List[str]:
        v = data.get(key) or []
        if not isinstance(v, list):
            return []
        return [str(x).strip() for x in v if str(x).strip()][:6]

    try:
        confidence = float(data.get("confidence", fallback.confidence))
    except (TypeError, ValueError):
        confidence = fallback.confidence
    confidence = max(0.0, min(1.0, confidence))

    return TriageAssessResult(
        urgency=urgency,
        rationale=str(data.get("rationale") or fallback.rationale).strip(),
        suggested_specialty=str(data.get("suggested_specialty") or fallback.suggested_specialty).strip(),
        red_flags=_str_list("red_flags") or fallback.red_flags,
        recommended_actions=_str_list("recommended_actions") or fallback.recommended_actions,
        confidence=confidence,
        ai_powered=True,
    )


# ---------- public entry point ----------

def assess_triage(req: TriageAssessRequest) -> TriageAssessResult:
    """Call Claude for advisory triage. Fall back to deterministic rules on any failure."""
    deterministic = _deterministic_assessment(req)
    llm = _get_llm()
    if llm is None:
        return deterministic

    prompt = ChatPromptTemplate.from_messages([
        ("system", _SYSTEM_PROMPT),
        ("user",
         "Chief complaint: {chief_complaint}\n"
         "Symptoms reported: {symptoms}\n"
         "Duration (days): {duration_days}\n"
         "Pain level (0-10): {pain_level}\n"
         "Fever: {fever}\n"
         "Chest pain reported: {chest_pain}\n"
         "Shortness of breath reported: {shortness_of_breath}\n\n"
         "Return the JSON object described in the system message."),
    ])
    try:
        chain = prompt | llm
        resp = chain.invoke({
            "chief_complaint": req.chief_complaint,
            "symptoms": ", ".join(req.symptoms) if req.symptoms else "(none listed)",
            "duration_days": req.duration_days,
            "pain_level": req.pain_level,
            "fever": "yes" if req.fever else "no",
            "chest_pain": "yes" if req.chest_pain else "no",
            "shortness_of_breath": "yes" if req.shortness_of_breath else "no",
        })
        content = extract_text(resp)
        if not content.strip():
            log.warning("LLM returned empty content, using deterministic fallback")
            return deterministic
        parsed = _parse_llm_output(content, deterministic)
        if not parsed.ai_powered:
            log.warning("LLM output could not be parsed as JSON, using deterministic fallback. "
                        "First 200 chars of raw output: %r", content[:200])
        return parsed
    except Exception as exc:
        # Log the real reason (API key wrong, model unavailable, quota, network)
        # so the operator can diagnose. Still return the deterministic fallback
        # so the patient-facing flow never breaks.
        log.exception("AI triage call failed (%s: %s) — using deterministic fallback",
                      type(exc).__name__, str(exc)[:300])
        return deterministic
