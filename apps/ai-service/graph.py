from typing import TypedDict, Optional, Dict, Any

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langgraph.graph import StateGraph, START, END

from llm_factory import get_llm as _factory_get_llm


load_dotenv()


# Structured consultation summary schema
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
        description="Explicitly identified missing, unconfirmed, or unknown clinical details."
    )

    safety_disclaimer: str = Field(
        default=(
            "ADVISORY ONLY: This consultation summary is AI-generated "
            "for clinical documentation assistance. It does not constitute "
            "a certified medical diagnosis and must be reviewed and confirmed "
            "by the attending doctor."
        ),
        description="Safety and compliance disclaimer."
    )


# LangGraph state definition
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


# Centralised LLM configuration
def get_llm():

    return _factory_get_llm(
        temperature=0.1,
        max_tokens=768,
        title="PulseCare Consultation Summary"
    )


# Node 1: Preprocess transcript and manage context
def preprocess_and_manage_context(state: ConsultationState) -> dict:

    raw_transcript = (state.get("transcript") or "").strip()
    raw_notes = (state.get("doctor_notes") or "").strip()

    # Normalize dialogue lines
    lines = [
        line.strip()
        for line in raw_transcript.splitlines()
        if line.strip()
    ]

    cleaned_transcript = "\n".join(lines)

    total_words = len(cleaned_transcript.split())

    is_trivial = total_words < 8 and not raw_notes

    # Limit exceptionally long transcripts
    max_char_len = 12000

    if len(cleaned_transcript) > max_char_len:

        half = max_char_len // 2

        head = cleaned_transcript[:half]
        tail = cleaned_transcript[-half:]

        cleaned_transcript = (
            f"{head}\n\n"
            "[... Transcript condensed for clinical processing ...]\n\n"
            f"{tail}"
        )

    return {
        "sanitized_transcript": cleaned_transcript,
        "is_empty_or_trivial": is_trivial,
    }


# Node 2: Generate structured consultation summary
def extract_structured_summary(state: ConsultationState) -> dict:

    patient_name = state.get("patient_name") or "Patient"
    doctor_name = state.get("doctor_name") or "Doctor"

    chief_complaint = (
        state.get("chief_complaint")
        or "Telehealth medical consultation"
    )

    doctor_notes = state.get("doctor_notes") or ""

    transcript = state.get("sanitized_transcript") or ""

    is_trivial = state.get("is_empty_or_trivial", False)

    # Handle empty or trivial conversations
    # without inventing clinical information
    if is_trivial:

        fallback_summary = {

            "reason_for_consultation": chief_complaint,

            "patient_reported_symptoms": (
                f"No verbal symptom statements recorded in dialogue "
                f"for chief complaint: '{chief_complaint}'."
            ),

            "discussion_points": (
                "Video consultation session concluded without "
                "recorded verbal dialogue or chat transcript."
            ),

            "doctor_observations_and_advice": (
                doctor_notes
                if doctor_notes
                else "No specific clinician notes entered during the video session."
            ),

            "recommended_next_steps": (
                "Review digital prescription in the patient portal "
                "if issued by doctor. Follow clinical instructions "
                "provided directly by clinician."
            ),

            "follow_up_recommendations": (
                "Schedule a follow-up consultation if symptoms persist "
                "or worsen. Seek immediate emergency medical care "
                "for acute distress."
            ),

            "missing_information": (
                "Complete audio transcript was unavailable or not recorded. "
                "Objective vital signs and detailed symptom timeline "
                "pending clinician confirmation."
            ),

            "safety_disclaimer": (
                "ADVISORY ONLY: Summary compiled from session booking "
                "data and doctor notes. No verbal transcript was available."
            ),
        }

        return {
            "structured_summary": fallback_summary
        }

    # JSON output parser
    parser = JsonOutputParser(
        pydantic_object=StructuredConsultationSummary
    )

    # System instructions
    system_prompt = (

        "You are an expert clinical documentation specialist "
        "in a telehealth setting. "

        "Your task is to analyze the video consultation dialogue "
        "transcript and doctor's notes, and generate a strictly "
        "factual, structured clinical summary.\n\n"

        "CLINICAL SAFETY GUIDELINES (STRICT):\n"

        "1. DO NOT INVENT or extrapolate symptoms, diagnoses, "
        "vital signs, or medications not explicitly stated "
        "in the transcript or notes.\n"

        "2. DISTINGUISH patient-reported subjective statements "
        "from doctor's objective clinical advice.\n"

        "3. CLEARLY IDENTIFY MISSING INFORMATION: If allergies, "
        "duration of illness, temperature, or vitals were not "
        "discussed, explicitly state that in 'missing_information'.\n"

        "4. KEEP ADVISORY: Frame observations neutrally as "
        "discussion points, not definitive in-person clinical diagnoses.\n"

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

    # User input
    user_prompt = (

        f"Patient Name: {patient_name}\n"

        f"Doctor Name: {doctor_name}\n"

        f"Booked Chief Complaint: {chief_complaint}\n"

        f"Doctor's In-Call Notes: {doctor_notes}\n"

        f"Consultation Dialogue Transcript:\n{transcript}\n\n"

        "Generate the structured clinical consultation summary "
        "in the required JSON format."
    )

    # Generate summary using centralised LLM factory
    try:

        llm = get_llm()

        prompt = ChatPromptTemplate.from_messages([

            (
                "system",
                system_prompt + "\n\n{format_instructions}"
            ),

            (
                "user",
                user_prompt
            ),

        ]).partial(

            format_instructions=parser.get_format_instructions()

        )

        chain = prompt | llm | parser

        parsed = chain.invoke({})

        if parsed and isinstance(parsed, dict):

            return {
                "structured_summary": parsed
            }

    except Exception as e:

        print(f"LLM summary generation failed: {e}")

    # Offline fallback if AI generation fails
    notes_text = (
        doctor_notes
        if doctor_notes
        else "Clinician evaluated patient during video consultation."
    )

    fallback_summary = {

        "reason_for_consultation": chief_complaint,

        "patient_reported_symptoms": (
            f"Patient reported chief complaint: '{chief_complaint}'. "
            "Dialogue transcript recorded."
        ),

        "discussion_points": (
            f"Video consultation conducted between {patient_name} "
            f"and {doctor_name} regarding reported symptoms."
        ),

        "doctor_observations_and_advice": notes_text,

        "recommended_next_steps": (
            "Review digital prescription in portal if issued. "
            "Follow clinical instructions provided."
        ),

        "follow_up_recommendations": (
            "Routine follow-up in 7-10 days if symptoms do not improve. "
            "Seek immediate emergency care if breathing difficulty "
            "or severe chest pain occurs."
        ),

        "missing_information": (
            "AI service operating in offline mode. Detailed symptom "
            "timeline and vitals require attending doctor's direct "
            "manual review."
        ),

        "safety_disclaimer": (
            "ADVISORY ONLY: Summary compiled with fallback parser. "
            "Attending clinician review and confirmation required."
        ),
    }

    return {
        "structured_summary": fallback_summary
    }


# Node 3: Safety audit and compliance guardrail
def safety_and_compliance_guardrail(state: ConsultationState) -> dict:

    summary = dict(state.get("structured_summary") or {})

    # Mandatory clinical disclaimer
    mandatory_disclaimer = (

        "ADVISORY ONLY: This consultation summary is AI-generated "
        "for clinical documentation assistance (LangChain + LangGraph). "

        "It does not constitute a certified medical diagnosis. "
        "The attending clinician must review, edit as necessary, "
        "and confirm this record before it is finalized."
    )

    summary["safety_disclaimer"] = mandatory_disclaimer

    # Required summary fields and fallback values
    fields_to_check = [

        (
            "reason_for_consultation",
            "Telehealth consultation follow-up"
        ),

        (
            "patient_reported_symptoms",
            "Symptoms evaluated during consultation."
        ),

        (
            "discussion_points",
            "Clinical discussion conducted between patient and clinician."
        ),

        (
            "doctor_observations_and_advice",
            "Clinician advice provided during consultation."
        ),

        (
            "recommended_next_steps",
            "Adhere to digital prescription and clinical recommendations."
        ),

        (
            "follow_up_recommendations",
            "Follow up with physician if symptoms persist."
        ),

        (
            "missing_information",
            "None explicitly noted."
        ),

    ]

    for key, default_val in fields_to_check:

        if not summary.get(key) or not str(summary.get(key)).strip():

            summary[key] = default_val

    return {
        "structured_summary": summary
    }


# Build and compile the LangGraph pipeline
def build_consultation_summary_graph():

    builder = StateGraph(ConsultationState)

    # Register nodes
    builder.add_node(
        "preprocess_and_manage_context",
        preprocess_and_manage_context
    )

    builder.add_node(
        "extract_structured_summary",
        extract_structured_summary
    )

    builder.add_node(
        "safety_and_compliance_guardrail",
        safety_and_compliance_guardrail
    )

    # Define execution flow
    builder.add_edge(
        START,
        "preprocess_and_manage_context"
    )

    builder.add_edge(
        "preprocess_and_manage_context",
        "extract_structured_summary"
    )

    builder.add_edge(
        "extract_structured_summary",
        "safety_and_compliance_guardrail"
    )

    builder.add_edge(
        "safety_and_compliance_guardrail",
        END
    )

    return builder.compile()


# Initialize consultation summary graph
consultation_graph = build_consultation_summary_graph()