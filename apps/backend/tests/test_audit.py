# Implements: NFR-06
# Safety:    S6, S7
# Owner:     backend (zhsraD)

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from src.audit.helper import audit
# pyrefly: ignore [missing-import]
from src.models.audit import AuditAction, AuditLog


@pytest.mark.asyncio
async def test_audit_helper_writes_row_with_sanitized_metadata(db_session: AsyncSession):
    actor_id = uuid.uuid4()
    meta = {
        "reason": "Routine clinical check",
        "ssn": "123-45-6789",  # PHI to redact
        "password": "secretpassword",  # PHI to redact
        "department": "Cardiology",
    }

    log_entry = await audit(
        db_session,
        action=AuditAction.CREATE,
        entity_type="appointment",
        entity_id="appt-987",
        actor_user_id=actor_id,
        metadata=meta,
        ip="127.0.0.1",
        user_agent="PyTestClient/1.0",
    )
    await db_session.commit()

    assert log_entry is not None
    assert log_entry.id is not None

    # Query from DB to confirm persistence
    result = await db_session.execute(
        select(AuditLog).where(AuditLog.id == log_entry.id)
    )
    saved = result.scalar_one_or_none()
    assert saved is not None
    assert saved.action == "CREATE"
    assert saved.entity_type == "appointment"
    assert saved.entity_id == "appt-987"
    assert saved.actor_user_id == actor_id
    assert saved.ip_address == "127.0.0.1"

    # Verify PHI redaction
    assert saved.metadata_json["reason"] == "Routine clinical check"
    assert saved.metadata_json["department"] == "Cardiology"
    assert saved.metadata_json["ssn"] == "[REDACTED]"
    assert saved.metadata_json["password"] == "[REDACTED]"


@pytest.mark.asyncio
async def test_audit_logs_fire_on_user_registration(
    client: AsyncClient, db_session: AsyncSession
):
    reg_payload = {
        "email": "audit_patient@example.com",
        "password": "patientPassword123",
        "name": "Audit Patient",
    }
    res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201
    user_id_str = res.json()["id"]

    # Check that audit entry was written
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "user",
            AuditLog.entity_id == user_id_str,
            AuditLog.action == "REGISTER",
        )
    )
    audit_row = result.scalar_one_or_none()
    assert audit_row is not None
    assert audit_row.actor_user_id == uuid.UUID(user_id_str)
    assert audit_row.metadata_json.get("role") == "PATIENT"
