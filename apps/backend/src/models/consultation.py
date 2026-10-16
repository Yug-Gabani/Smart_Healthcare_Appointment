# Implements: FR-12, FR-17, FR-18
# Safety:    S5, S8
# Owner:     backend (Group 6)

import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base


class ConsentKind(str, enum.Enum):
    RECORDING = "RECORDING"
    DATA_PROCESSING = "DATA_PROCESSING"
    AI_ADVISORY = "AI_ADVISORY"


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=True, index=True
    )
    kind: Mapped[ConsentKind] = mapped_column(
        Enum(ConsentKind, native_enum=True, name="consent_kind_enum"),
        nullable=False,
        index=True,
    )
    granted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_consents_user_kind", "user_id", "kind"),
        Index("ix_consents_appointment_kind", "appointment_id", "kind"),
    )


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    room_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    recording_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    transcript_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # DR-15 physical column separation
    ai_soap_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    clinician_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
