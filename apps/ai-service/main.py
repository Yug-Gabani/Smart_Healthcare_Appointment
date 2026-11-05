import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from graph import consultation_graph, ConsultationState

app = FastAPI(
    title="PulseCare AI Service",
    description="LangChain + LangGraph Telehealth Meeting Summarizer powered by OpenRouter",
    version="1.0.0",
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
    chief_complaint: str
    observations: str
    doctor_advice: str
    prescribed_actions: str
    follow_up: str
    safety_disclaimer: str


@app.get("/health")
def health_check():
    openrouter_configured = bool(os.getenv("OPENROUTER_API_KEY", "").strip())
    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")
    return {
        "status": "healthy",
        "service": "ai-service",
        "engine": "LangGraph + LangChain",
        "openrouter_configured": openrouter_configured,
        "model": model,
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
            "observations": None,
            "doctor_advice": None,
            "prescribed_actions": None,
            "follow_up": None,
            "safety_disclaimer": None,
        }

        # Execute the LangGraph pipeline
        final_state = consultation_graph.invoke(initial_state)

        return ConsultationSummaryResponse(
            chief_complaint=payload.chief_complaint or "Teleconsultation follow-up",
            observations=final_state.get("observations") or "Clinical assessment completed.",
            doctor_advice=final_state.get("doctor_advice") or "Follow doctor instructions.",
            prescribed_actions=final_state.get("prescribed_actions") or "Review digital prescription.",
            follow_up=final_state.get("follow_up") or "Schedule follow-up in 7-10 days if symptoms persist.",
            safety_disclaimer=final_state.get("safety_disclaimer") or "PulseCare Telehealth AI Meeting Summary",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LangGraph summarization error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

