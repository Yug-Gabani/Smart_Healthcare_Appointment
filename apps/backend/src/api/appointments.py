# Implements: FR-03, FR-04, FR-06, FR-16
# Safety:    S1, S2, S3, S4, S6, S8, S9, S10
# Owner:     backend (Group 6)

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.graphs.triage_graph import GRAPH_VERSION, PROMPT_VERSION, triage_graph
from src.audit.helper import audit
from src.config import settings
from src.db.session import get_db
from src.deps import get_current_user, require_role
from src.models.appointment import Appointment, AppointmentStatus, TriageUrgency
from src.models.audit import AuditAction
from src.models.user import Role, User

router = APIRouter(prefix="/appointments", tags=["appointments"])


class QuestionnaireSubmission(BaseModel):
    symptoms: str
    responses: Dict[str, Any] = {}


class ClinicianReviewSubmission(BaseModel):
    clinician_urgency: TriageUrgency
    clinician_notes: str


class AppointmentResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: Optional[uuid.UUID]
    scheduled_at: Optional[datetime]
    status: AppointmentStatus
    symptoms_text: str
    questionnaire_responses: Dict[str, Any]

    # DR-15 separate AI and Clinician fields
    ai_urgency: Optional[TriageUrgency]
    ai_summary: Optional[str]
    ai_model: Optional[str]
    ai_prompt_version: Optional[str]
    ai_graph_version: Optional[str]
    ai_error: Optional[str]

    clinician_urgency: Optional[TriageUrgency]
    clinician_notes: Optional[str]
    clinician_reviewed_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_and_triage_appointment(
    payload: QuestionnaireSubmission,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    appointment = Appointment(
        patient_id=current_user.id,
        symptoms_text=payload.symptoms,
        questionnaire_responses=payload.responses,
        status=AppointmentStatus.PENDING_TRIAGE,
    )
    db.add(appointment)
    await db.flush()

    # Invoke LangGraph Triage pipeline (S1, S2, S3, S4, S10)
    initial_state = {
        "symptoms": payload.symptoms,
        "questionnaire": payload.responses,
        "is_emergency": False,
        "triage_result": None,
        "error": None,
        "graph_version": GRAPH_VERSION,
        "prompt_version": PROMPT_VERSION,
    }

    final_state = await triage_graph.ainvoke(initial_state)

    appointment.ai_model = settings.AI_MODEL
    appointment.ai_prompt_version = PROMPT_VERSION
    appointment.ai_graph_version = GRAPH_VERSION

    if final_state.get("error"):
        # S3: Fallback state
        appointment.status = AppointmentStatus.AWAITING_MANUAL_TRIAGE
        appointment.ai_error = final_state["error"]
    elif final_state.get("is_emergency"):
        # S2 & S4: Emergency immediate escalation
        appointment.status = AppointmentStatus.EMERGENCY_ESCALATED
        appointment.ai_urgency = TriageUrgency.EMERGENCY
        if final_state.get("triage_result"):
            appointment.ai_summary = final_state["triage_result"].summary
    else:
        # Standard advisory triage
        res = final_state.get("triage_result")
        if res:
            appointment.ai_urgency = res.urgency
            appointment.ai_summary = res.summary
        appointment.status = AppointmentStatus.TRIAGED

    await db.commit()
    await db.refresh(appointment)

    # S6: Audit every mutation
    await audit(
        db=db,
        action=AuditAction.TRIAGE,
        entity_type="appointment",
        entity_id=str(appointment.id),
        actor_user_id=current_user.id,
        metadata={
            "status": appointment.status.value,
            "ai_urgency": appointment.ai_urgency.value if appointment.ai_urgency else None,
        },
    )
    await db.commit()

    return appointment


@router.patch("/{appointment_id}/review", response_model=AppointmentResponse)
async def clinician_review_triage(
    appointment_id: uuid.UUID,
    payload: ClinicianReviewSubmission,
    doctor_user: User = Depends(require_role(Role.DOCTOR)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()

    if not appointment:
        # IDOR defence 404
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    # DR-15: Clinician inputs preserved in physically separate columns
    appointment.clinician_urgency = payload.clinician_urgency
    appointment.clinician_notes = payload.clinician_notes
    appointment.clinician_reviewed_at = datetime.utcnow()
    appointment.doctor_id = doctor_user.id
    appointment.status = AppointmentStatus.CONFIRMED

    await db.commit()
    await db.refresh(appointment)

    await audit(
        db=db,
        action=AuditAction.STATUS_CHANGE,
        entity_type="appointment",
        entity_id=str(appointment.id),
        actor_user_id=doctor_user.id,
        metadata={
            "clinician_urgency": payload.clinician_urgency.value,
            "status": appointment.status.value,
        },
    )
    await db.commit()

    return appointment


@router.get("", response_model=List[AppointmentResponse])
async def list_appointments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Appointment)
    # S8 3-layer RBAC: SQL scope filtering
    if current_user.role == Role.PATIENT:
        query = query.where(Appointment.patient_id == current_user.id)
    elif current_user.role == Role.DOCTOR:
        # Doctors see their assigned appointments or triaged queue
        query = query.where(
            (Appointment.doctor_id == current_user.id)
            | (Appointment.doctor_id.is_(None))
        )
    # ADMIN sees all

    query = query.order_by(Appointment.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()
