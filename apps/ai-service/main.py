import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List

from graph import consultation_graph, ConsultationState
from queue_advisor import QueuePatientItem, QueueAdvisorResult, analyze_doctor_queue
from llm_factory import active_provider, active_model

app = FastAPI(
    title="PulseCare AI Service",
    description="LangChain + LangGraph Telehealth Meeting Summarizer",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConsultationSummaryRequest(BaseModel):
    patient_name: Optional[str] = Field("Patient", description="Name of the patient")
    doctor_name: Optional[str] = Field("Doctor", description="Name of the clinician")
    chief_complaint: Optional[str] = Field("", description="Primary symptom or reason for visit")
    transcript: Optional[str] = Field("", description="Full conversation transcript or in-call chat logs")
    doctor_notes: Optional[str] = Field("", description="Clinician observations and notes taken during call")


class ConsultationSummaryResponse(BaseModel):
    # Core 6 clinical summary dimensions
    reason_for_consultation: str = Field(..., description="1. Reason for consultation")
    patient_reported_symptoms: str = Field(..., description="2. Patient-reported symptoms")
    discussion_points: str = Field(..., description="3. Important discussion points")
    doctor_observations_and_advice: str = Field(..., description="4. Doctor's observations and advice")
    recommended_next_steps: str = Field(..., description="5. Recommended next steps")
    follow_up_recommendations: str = Field(..., description="6. Follow-up recommendations")

    # Safety and missing information metadata
    missing_information: str = Field(..., description="Explicitly identified unconfirmed or missing medical information")
    safety_disclaimer: str = Field(..., description="Non-diagnostic clinical advisory disclaimer")

    # Backward compatibility aliases for existing backend consumers
    chief_complaint: str = Field(..., description="Chief complaint alias")
    communication_summary: Optional[str] = Field("", description="High-level communication summary")
    observations: str = Field(..., description="Clinical observations alias")
    doctor_advice: str = Field(..., description="Doctor advice alias")
    prescribed_actions: str = Field(..., description="Prescribed actions alias")
    follow_up: str = Field(..., description="Follow-up alias")


@app.get("/health")
def health_check():
    provider = active_provider()

    return {
        "status": "healthy",
        "service": "ai-service",
        "engine": "LangGraph + LangChain",
        "openrouter_configured": provider == "openrouter",
        "provider": provider,
        "ai_configured": provider != "none",
        "model": active_model() or "(none configured; deterministic fallback)",
        "version": "2.0.0",
    }


@app.post("/summarize-consultation", response_model=ConsultationSummaryResponse)
def summarize_consultation(payload: ConsultationSummaryRequest):
    try:
        initial_state: ConsultationState = {
            "patient_name": payload.patient_name or "Patient",
            "doctor_name": payload.doctor_name or "Doctor",
            "chief_complaint": payload.chief_complaint or "Telehealth consultation",
            "transcript": payload.transcript or "",
            "doctor_notes": payload.doctor_notes or "",
            "sanitized_transcript": None,
            "is_empty_or_trivial": None,
            "structured_summary": None,
            "error": None,
        }

        final_state = consultation_graph.invoke(initial_state)
        summary = final_state.get("structured_summary") or {}

        reason = summary.get("reason_for_consultation") or payload.chief_complaint or "Teleconsultation follow-up"
        symptoms = summary.get("patient_reported_symptoms") or "Symptoms evaluated during consultation."
        discussion = summary.get("discussion_points") or "Telehealth clinical review conducted."
        obs_advice = summary.get("doctor_observations_and_advice") or "Clinical assessment completed."
        next_steps = summary.get("recommended_next_steps") or "Review digital prescription in portal."
        follow_up = summary.get("follow_up_recommendations") or "Schedule follow-up in 7-10 days if symptoms persist."
        missing_info = summary.get("missing_information") or "None explicitly noted."
        disclaimer = summary.get("safety_disclaimer") or "PulseCare Telehealth AI Meeting Summary (Advisory Only)"

        # Composite communication summary for legacy logging
        comm_summary = (
            f"Video consultation conducted between {payload.patient_name or 'Patient'} "
            f"and {payload.doctor_name or 'Doctor'} regarding '{reason}'. "
            "Patient discussed symptoms and history. Clinician provided guidance and recommendations."
        )

        return ConsultationSummaryResponse(
            reason_for_consultation=reason,
            patient_reported_symptoms=symptoms,
            discussion_points=discussion,
            doctor_observations_and_advice=obs_advice,
            recommended_next_steps=next_steps,
            follow_up_recommendations=follow_up,
            missing_information=missing_info,
            safety_disclaimer=disclaimer,
            chief_complaint=reason,
            communication_summary=comm_summary,
            observations=f"Patient Symptoms: {symptoms}\n\nClinical Assessment: {obs_advice}",
            doctor_advice=obs_advice,
            prescribed_actions=next_steps,
            follow_up=follow_up,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LangGraph summarization error: {str(e)}"
        )


class QueueAdvisorRequest(BaseModel):
    doctor_name: Optional[str] = Field("Doctor", description="Attending clinician name")
    queue: List[QueuePatientItem] = Field(default_factory=list, description="Current appointment queue")


@app.post("/queue-advisor", response_model=QueueAdvisorResult)
def queue_advisor(payload: QueueAdvisorRequest):
    """
    LangChain Clinical Triage Advisor for Doctor Queue.
    Evaluates emergency severity, red-flag symptoms, and recommends optimal priority ordering.
    """
    try:
        return analyze_doctor_queue(
            payload.queue,
            doctor_name=payload.doctor_name or "Doctor"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI Queue Advisor error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)