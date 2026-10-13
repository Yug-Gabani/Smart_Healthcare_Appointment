# Implements: FR-01, FR-02
# Safety:    S8
# Owner:     backend (zhsraD)

import enum
from datetime import datetime
from typing import Optional
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from sqlalchemy import DateTime, Enum, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, TimestampMixin


class Role(str, enum.Enum):
    PATIENT = "PATIENT"
    CAREGIVER = "CAREGIVER"
    DOCTOR = "DOCTOR"
    NURSE = "NURSE"
    PHARMACIST = "PHARMACIST"
    PHARMACY_STAFF = "PHARMACY_STAFF"
    RECEPTION = "RECEPTION"
    CLINIC_ADMIN = "CLINIC_ADMIN"
    SYSTEM_ADMIN = "SYSTEM_ADMIN"
    # Backwards compatibility alias
    ADMIN = "SYSTEM_ADMIN"


class User(SQLAlchemyBaseUserTableUUID, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    role: Mapped[Role] = mapped_column(
        Enum(
            Role,
            native_enum=True,
            name="user_role_enum",
            values_callable=lambda x: [
                e.value
                for e in [
                    Role.PATIENT,
                    Role.CAREGIVER,
                    Role.DOCTOR,
                    Role.NURSE,
                    Role.PHARMACIST,
                    Role.PHARMACY_STAFF,
                    Role.RECEPTION,
                    Role.CLINIC_ADMIN,
                    Role.SYSTEM_ADMIN,
                ]
            ],
        ),
        nullable=False,
        default=Role.PATIENT,
        index=True,
    )
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_users_role_is_active", "role", "is_active"),
    )
