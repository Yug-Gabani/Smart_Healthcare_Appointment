import os
import json
import re
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

def get_llm():
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")
    if not api_key:
        return None
    return ChatOpenAI(
        model=model,
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://pulsecare.local",
            "X-Title": "PulseCare Smart Healthcare Telehealth",
        },
        temperature=0.1,
    )

class QueuePatientItem(BaseModel):
    id: str
    patient_id: Optional[str] = ""
    patient_name: str
    chief_complaint: Optional[str] = "Consultation follow-up"
    urgency: str = "RTN"  # 'EMG' | 'URG' | 'RTN'
    confidence: Optional[Union[float, int]] = 75.0
    slot: Optional[str] = ""
    mode: Optional[str] = "VID"
    symptoms: Optional[List[str]] = Field(default_factory=list)

class QueueAdvisorResult(BaseModel):
    overall_assessment: str
    priority_recommendation: str
    suggested_order_ids: List[str]
    emergency_count: int
    urgent_count: int
    routine_count: int
    clinical_alerts: List[str]

def fallback_clinical_triage(queue: List[QueuePatientItem], doctor_name: str) -> QueueAdvisorResult:
    """Deterministic, resilient clinical priority fallback when LLM is unavailable."""
    urgency_ranks = {
        "EMG": 0, "EMERGENCY": 0,
        "URG": 1, "URGENT": 1,
        "RTN": 2, "ROUTINE": 2,
    }
    critical_keywords = [
        "chest pain", "tightness", "breath", "dyspnea", "stroke", "paralysis", 
        "bleeding", "unconscious", "anaphylaxis", "severe burn", "trauma", "head injury", "aura"
    ]
    
    def score_item(item: QueuePatientItem):
        complaint_lower = (item.chief_complaint or "").lower()
        has_critical = any(kw in complaint_lower for kw in critical_keywords)
        rank = urgency_ranks.get(item.urgency.upper(), 2)
        # If it has critical keywords, elevate priority score
        return (0 if has_critical else 1, rank, -(item.confidence or 50))

    sorted_queue = sorted(queue, key=score_item)
    suggested_ids = [item.id for item in sorted_queue]

    emg_count = sum(1 for q in queue if q.urgency.upper() in ("EMG", "EMERGENCY"))
    urg_count = sum(1 for q in queue if q.urgency.upper() in ("URG", "URGENT"))
    rtn_count = sum(1 for q in queue if q.urgency.upper() in ("RTN", "ROUTINE"))

    alerts = []
    top_critical = None
    for item in sorted_queue:
        complaint = item.chief_complaint or "No complaint reported"
        complaint_lower = complaint.lower()
        if item.urgency.upper() in ("EMG", "EMERGENCY") or any(kw in complaint_lower for kw in critical_keywords):
            if not top_critical:
                top_critical = item
            alerts.append(f"🚨 Immediate Alert for {item.patient_name} ({item.patient_id}): {complaint} - potential acute risk.")
        elif item.urgency.upper() in ("URG", "URGENT"):
            alerts.append(f"⚠️ Urgent Review for {item.patient_name} ({item.patient_id}): {complaint}.")

    if top_critical:
        priority_rec = (
            f"Prioritize {top_critical.patient_name} ({top_critical.patient_id}) immediately. "
            f"Presenting with '{top_critical.chief_complaint}' with high emergency triage classification. "
            f"Attend to this patient before proceeding to routine reviews."
        )
        assessment = (
            f"Queue contains {emg_count} emergency case(s) and {urg_count} urgent case(s). "
            f"Immediate physician intervention is advised for acute symptoms."
        )
    elif urg_count > 0:
        priority_rec = (
            f"Attend to urgent appointments first ({sorted_queue[0].patient_name}), "
            f"followed by standard routine appointments in scheduled order."
        )
        assessment = f"Moderate workload: {urg_count} urgent case(s) detected. Queue ordered by clinical triage urgency."
    else:
        priority_rec = "All active appointments are routine. Follow the scheduled slot timetable normally."
        assessment = f"Queue is fully stable ({rtn_count} routine consultations). No critical emergency flags detected."

    return QueueAdvisorResult(
        overall_assessment=assessment,
        priority_recommendation=priority_rec,
        suggested_order_ids=suggested_ids,
        emergency_count=emg_count,
        urgent_count=urg_count,
        routine_count=rtn_count,
        clinical_alerts=alerts or ["All patients presenting with stable routine symptoms."],
    )

def analyze_doctor_queue(queue: List[QueuePatientItem], doctor_name: str = "Doctor") -> QueueAdvisorResult:
    """Executes a LangChain chain with OpenRouter to evaluate emergency urgency and advise doctor."""
    if not queue:
        return QueueAdvisorResult(
            overall_assessment="Queue is currently empty. No pending patient appointments.",
            priority_recommendation="No immediate clinical actions required.",
            suggested_order_ids=[],
            emergency_count=0,
            urgent_count=0,
            routine_count=0,
            clinical_alerts=[],
        )

    llm = get_llm()
    if not llm:
        return fallback_clinical_triage(queue, doctor_name)

    formatted_items = []
    for idx, item in enumerate(queue, start=1):
        formatted_items.append(
            f"[{idx}] ID: {item.id} | Patient: {item.patient_name} ({item.patient_id}) | "
            f"Urgency: {item.urgency} | Chief Complaint: {item.chief_complaint} | "
            f"Slot: {item.slot} | Mode: {item.mode}"
        )
    items_text = "\n".join(formatted_items)

    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a Hospital Emergency Medical Director & AI Clinical Triage Specialist. "
            "Your job is to analyze the doctor's appointment queue and prioritize patients "
            "based strictly on clinical urgency, life-safety risks, and emergency red-flags.\n\n"
            "Return a strictly valid JSON object matching this schema:\n"
            "{\n"
            '  "overall_assessment": "1-2 sentences summarizing emergency workload",\n'
            '  "priority_recommendation": "Specific action advice: who the doctor must see first and why",\n'
            '  "suggested_order_ids": ["id1", "id2", ...],\n'
            '  "clinical_alerts": ["Alert 1", "Alert 2"]\n'
            "}\n"
            "Do not include Markdown backticks or text outside the JSON."
        )),
        ("user", (
            "Attending Clinician: {doctor_name}\n\n"
            "Current Total Queue:\n"
            "{items_text}\n\n"
            "Provide Clinical Emergency Queue Triage JSON:"
        )),
    ])

    chain = prompt | llm | StrOutputParser()

    try:
        raw_output = chain.invoke({"doctor_name": doctor_name, "items_text": items_text})
        # Extract JSON if enclosed in markdown code fences
        cleaned = raw_output.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()

        data = json.loads(cleaned)

        emg_count = sum(1 for q in queue if q.urgency.upper() == "EMG")
        urg_count = sum(1 for q in queue if q.urgency.upper() == "URG")
        rtn_count = sum(1 for q in queue if q.urgency.upper() == "RTN")

        suggested_ids = data.get("suggested_order_ids", [])
        # Ensure all IDs from original queue are present
        original_ids = [q.id for q in queue]
        valid_suggested = [x for x in suggested_ids if x in original_ids]
        for missing in original_ids:
            if missing not in valid_suggested:
                valid_suggested.append(missing)

        return QueueAdvisorResult(
            overall_assessment=data.get("overall_assessment") or f"Queue evaluated: {emg_count} emergency, {urg_count} urgent.",
            priority_recommendation=data.get("priority_recommendation") or "Review patients according to urgency.",
            suggested_order_ids=valid_suggested,
            emergency_count=emg_count,
            urgent_count=urg_count,
            routine_count=rtn_count,
            clinical_alerts=data.get("clinical_alerts") or [],
        )
    except Exception as e:
        # Fallback to deterministic triage algorithm if LLM parsing or network fails
        return fallback_clinical_triage(queue, doctor_name)
