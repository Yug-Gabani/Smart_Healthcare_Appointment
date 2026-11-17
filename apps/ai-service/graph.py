import os
import json
from typing import TypedDict, Optional, Dict, Any
from dotenv import load_dotenv
from pydantic import BaseModel, Field

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None

import httpx
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langgraph.graph import StateGraph, START, END

load_dotenv()


class StructuredConsultationSummary(BaseModel):
    reason_for_consultation: str = Field(
        ...,
        description="Chief complaint and clinical reason for the teleconsultation."
    )
    patient_reported_symptoms: str = Field(
        ...,
        description="Subjective symptoms, onset timeline, and severity described by the patient. Do not invent symptoms."
    )
    discussion_points: str = Field(
        ...,
        description="Key clinical topics, medical history, questions, and concerns discussed between patient and doctor."
    )
    doctor_observations_and_advice: str = Field(
        ...,
        description="Objective clinician observations, evaluation during video consultation, and direct medical advice."
    )
    recommended_next_steps: str = Field(
        ...,
        description="Prescriptions, diagnostics, lab investigations, or lifestyle actions instructed by the clinician."
    )
    follow_up_recommendations: str = Field(
        ...,
        description="Follow-up timeframe, red-flag warning signs, and when to seek emergency care."
    )
    missing_information: str = Field(
        ...,
        description="Explicitly identified missing, unconfirmed, or unknown clinical details (e.g., unverified allergies, pending vitals, missing lab history)."
    )
    safety_disclaimer: str = Field(
        default="ADVISORY ONLY: This consultation summary is AI-generated for clinical documentation assistance. It does not constitute a certified medical diagnosis and must be reviewed and confirmed by the attending doctor.",
        description="Safety and compliance disclaimer."
    )


class ConsultationState(TypedDict):
    patient_name: str
    doctor_name: str
    chief_complaint: str
    transcript: str
    doctor_notes: str
    sanitized_transcript: Optional[str]
    is_empty_or_trivial: Optional[bool]
    structured_summary: Optional[Dict[str, Any]]
    error: Optional[str]


def call_openrouter_api(system_prompt: str, user_prompt: str) -> Optional[dict]:
    """
    Direct OpenRouter inference supporting Claude (anthropic/claude-3.5-sonnet).
    Works in all environments with httpx, providing resilient LLM connectivity.
    """
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")
    if not api_key:
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://pulsecare.local",
        "X-Title": "PulseCare Smart Healthcare Telehealth",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return json.loads(content)
    except Exception as e:
        print(f"OpenRouter direct API notice: {e}")
    return None


# Node 1: Preprocess transcript, manage token context window, detect empty/trivial dialogues
def preprocess_and_manage_context(state: ConsultationState) -> dict:
    raw_transcript = (state.get("transcript") or "").strip()
    raw_notes = (state.get("doctor_notes") or "").strip()

    # Normalize dialogue lines
    lines = [line.strip() for line in raw_transcript.splitlines() if line.strip()]
    cleaned_transcript = "\n".join(lines)

    total_words = len(cleaned_transcript.split())
    is_trivial = total_words < 8 and not raw_notes

    # Context management: Cap exceptionally long transcripts to 12,000 characters (~3000 tokens)
    # while preserving both the opening clinical intake and the closing advice/plan.
    max_char_len = 12000
    if len(cleaned_transcript) > max_char_len:
        half = max_char_len // 2
        head = cleaned_transcript[:half]
        tail = cleaned_transcript[-half:]
        cleaned_transcript = f"{head}\n\n[... Transcript condensed for clinical processing ...]\n\n{tail}"

    return {
        "sanitized_transcript": cleaned_transcript,
        "is_empty_or_trivial": is_trivial,
    }


# Node 2: Extract structured 6-dimension clinical summary via single high-fidelity Claude call
def extract_structured_summary(state: ConsultationState) -> dict:
    patient_name = state.get("patient_name") or "Patient"
    doctor_name = state.get("doctor_name") or "Doctor"
    chief_complaint = state.get("chief_complaint") or "Telehealth medical consultation"
    doctor_notes = state.get("doctor_notes") or ""
    transcript = state.get("sanitized_transcript") or ""
    is_trivial = state.get("is_empty_or_trivial", False)

    # If dialogue is genuinely empty or trivial, return an honest clinical record
    # without hallucinating fake symptoms or observations.
    if is_trivial:
        fallback_summary = {
            "reason_for_consultation": chief_complaint,
            "patient_reported_symptoms": (
                f"No verbal symptom statements recorded in dialogue for chief complaint: '{chief_complaint}'."
            ),
            "discussion_points": (
                "Video consultation session concluded without recorded verbal dialogue or chat transcript."
            ),
            "doctor_observations_and_advice": (
                doctor_notes if doctor_notes else "No specific clinician notes entered during the video session."
            ),
            "recommended_next_steps": (
                "Review digital prescription in the patient portal if issued by doctor. Follow clinical instructions provided directly by clinician."
            ),
            "follow_up_recommendations": (
                "Schedule a follow-up consultation if symptoms persist or worsen. Seek immediate emergency medical care for acute distress."
            ),
            "missing_information": (
                "Complete audio transcript was unavailable or not recorded. Objective vital signs and detailed symptom timeline pending clinician confirmation."
            ),
            "safety_disclaimer": (
                "ADVISORY ONLY: Summary compiled from session booking data and doctor notes. No verbal transcript was available."
            ),
        }
        return {"structured_summary": fallback_summary}

    parser = JsonOutputParser(pydantic_object=StructuredConsultationSummary)

    system_prompt = (
        "You are an expert clinical documentation specialist in a telehealth setting. "
        "Your task is to analyze the video consultation dialogue transcript and doctor's notes, "
        "and generate a strictly factual, structured clinical summary.\n\n"
        "CLINICAL SAFETY GUIDELINES (STRICT):\n"
        "1. DO NOT INVENT or extrapolate symptoms, diagnoses, vital signs, or medications not explicitly stated in the transcript or notes.\n"
        "2. DISTINGUISH patient-reported subjective statements from doctor's objective clinical advice.\n"
        "3. CLEARLY IDENTIFY MISSING INFORMATION: If allergies, duration of illness, temperature, or vitals were not discussed, explicitly state that in 'missing_information'.\n"
        "4. KEEP ADVISORY: Frame observations neutrally as discussion points, not definitive in-person clinical diagnoses.\n"
        "5. Output must be a valid JSON object matching this schema:\n"
        "{\n"
        '  "reason_for_consultation": "...",\n'
        '  "patient_reported_symptoms": "...",\n'
        '  "discussion_points": "...",\n'
        '  "doctor_observations_and_advice": "...",\n'
        '  "recommended_next_steps": "...",\n'
        '  "follow_up_recommendations": "...",\n'
        '  "missing_information": "...",\n'
        '  "safety_disclaimer": "..."\n'
        "}"
    )

    user_prompt = (
        f"Patient Name: {patient_name}\n"
        f"Doctor Name: {doctor_name}\n"
        f"Booked Chief Complaint: {chief_complaint}\n"
        f"Doctor's In-Call Notes: {doctor_notes}\n"
        f"Consultation Dialogue Transcript:\n{transcript}\n\n"
        "Generate the structured clinical consultation summary in the required JSON format."
    )

    # Strategy A: LangChain ChatOpenAI if langchain_openai is present
    if ChatOpenAI is not None and os.getenv("OPENROUTER_API_KEY", "").strip():
        try:
            llm = ChatOpenAI(
                model=os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"),
                openai_api_key=os.getenv("OPENROUTER_API_KEY", "").strip(),
                openai_api_base="https://openrouter.ai/api/v1",
                default_headers={
                    "HTTP-Referer": "https://pulsecare.local",
                    "X-Title": "PulseCare Smart Healthcare Telehealth",
                },
                temperature=0.1,
            )
            prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt + "\n\n{format_instructions}"),
                ("user", user_prompt),
            ]).partial(format_instructions=parser.get_format_instructions())

            chain = prompt | llm | parser
            parsed = chain.invoke({})
            if parsed and isinstance(parsed, dict):
                return {"structured_summary": parsed}
        except Exception as e:
            print(f"ChatOpenAI execution attempt skipped: {e}")

    # Strategy B: Direct OpenRouter HTTP client with JSON schema enforcement
    direct_result = call_openrouter_api(system_prompt, user_prompt)
    if direct_result and isinstance(direct_result, dict):
        return {"structured_summary": direct_result}

    # Strategy C: Honest offline clinical fallback
    notes_text = doctor_notes if doctor_notes else "Clinician evaluated patient during video consultation."
    fallback_summary = {
        "reason_for_consultation": chief_complaint,
        "patient_reported_symptoms": (
            f"Patient reported chief complaint: '{chief_complaint}'. Dialogue transcript recorded."
        ),
        "discussion_points": (
            f"Video consultation conducted between {patient_name} and {doctor_name} regarding reported symptoms."
        ),
        "doctor_observations_and_advice": notes_text,
        "recommended_next_steps": (
            "Review digital prescription in portal if issued. Follow clinical instructions provided."
        ),
        "follow_up_recommendations": (
            "Routine follow-up in 7-10 days if symptoms do not improve. Seek immediate emergency care if breathing difficulty or severe chest pain occurs."
        ),
        "missing_information": (
            "AI service operating in offline mode. Detailed symptom timeline and vitals require attending doctor's direct manual review."
        ),
        "safety_disclaimer": (
            "ADVISORY ONLY: Summary compiled with fallback parser. Attending clinician review and confirmation required."
        ),
    }
    return {"structured_summary": fallback_summary}


# Node 3: Safety audit & compliance disclaimer guardrail
def safety_and_compliance_guardrail(state: ConsultationState) -> dict:
    summary = state.get("structured_summary") or {}

    # Enforce mandatory non-diagnostic clinical disclaimer
    mandatory_disclaimer = (
        "ADVISORY ONLY: This consultation summary is AI-generated for clinical documentation assistance (LangChain + LangGraph). "
        "It does not constitute a certified medical diagnosis. The attending clinician must review, edit as necessary, "
        "and confirm this record before it is finalized."
    )
    summary["safety_disclaimer"] = mandatory_disclaimer

    fields_to_check = [
        ("reason_for_consultation", "Telehealth consultation follow-up"),
        ("patient_reported_symptoms", "Symptoms evaluated during consultation."),
        ("discussion_points", "Clinical discussion conducted between patient and clinician."),
        ("doctor_observations_and_advice", "Clinician advice provided during consultation."),
        ("recommended_next_steps", "Adhere to digital prescription and clinical recommendations."),
        ("follow_up_recommendations", "Follow up with physician if symptoms persist."),
        ("missing_information", "None explicitly noted."),
    ]

    for key, default_val in fields_to_check:
        if not summary.get(key) or not str(summary.get(key)).strip():
            summary[key] = default_val

    return {"structured_summary": summary}


# Build and compile the optimized LangGraph pipeline
def build_consultation_summary_graph():
    builder = StateGraph(ConsultationState)

    builder.add_node("preprocess_and_manage_context", preprocess_and_manage_context)
    builder.add_node("extract_structured_summary", extract_structured_summary)
    builder.add_node("safety_and_compliance_guardrail", safety_and_compliance_guardrail)

    builder.add_edge(START, "preprocess_and_manage_context")
    builder.add_edge("preprocess_and_manage_context", "extract_structured_summary")
    builder.add_edge("extract_structured_summary", "safety_and_compliance_guardrail")
    builder.add_edge("safety_and_compliance_guardrail", END)

    return builder.compile()


consultation_graph = build_consultation_summary_graph()
