# Implements: FR-03, FR-04, FR-06, FR-16
# Safety:    S1, S2, S3, S4, S10
# Owner:     backend (Group 6)

import enum
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    Computed,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base


class AppointmentStatus(str, enum.Enum):
    PENDING_TRIAGE = "PENDING_TRIAGE"
    AWAITING_MANUAL_TRIAGE = "AWAITING_MANUAL_TRIAGE"
    EMERGENCY_ESCALATED = "EMERGENCY_ESCALATED"
    TRIAGED = "TRIAGED"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TriageUrgency(str, enum.Enum):
    EMERGENCY = "EMERGENCY"
    URGENT = "URGENT"
    ROUTINE = "ROUTINE"
    SELF_CARE = "SELF_CARE"


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    scheduled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, native_enum=True, name="appointment_status_enum"),
        nullable=False,
        default=AppointmentStatus.PENDING_TRIAGE,
        index=True,
    )

    # Pre-visit questionnaire inputs
    symptoms_text: Mapped[str] = mapped_column(Text, nullable=False)
    questionnaire_responses: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    # DR-15 & S1 / S10: AI vs Clinician Physical Column Separation
    ai_urgency: Mapped[Optional[TriageUrgency]] = mapped_column(
        Enum(TriageUrgency, native_enum=True, name="triage_urgency_enum"),
        nullable=True,
    )
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_model: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ai_prompt_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    ai_graph_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    ai_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    clinician_urgency: Mapped[Optional[TriageUrgency]] = mapped_column(
        Enum(TriageUrgency, native_enum=True, name="clinician_triage_urgency_enum"),
        nullable=True,
    )
    clinician_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    clinician_reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_appointments_status_scheduled_at", "status", "scheduled_at"),
        Index("ix_appointments_patient_status", "patient_id", "status"),
        Index("ix_appointments_doctor_status", "doctor_id", "status"),
    )
