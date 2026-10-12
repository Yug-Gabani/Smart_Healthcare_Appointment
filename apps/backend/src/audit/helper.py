# Implements: NFR-03, NFR-04
# Safety:    S6, S7
# Owner:     backend (Group 6)

import uuid
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from src.models.audit import AuditAction, AuditLog

logger = structlog.get_logger()

# Strip any obvious direct PHI keys in metadata
PHI_KEYS = {
    "ssn",
    "password",
    "token",
    "credit_card",
    "card_number",
    "cvv",
    "patient_name",
    "name",
    "email",
    "phone",
    "address",
}


def sanitize_metadata(meta: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not meta:
        return {}
    sanitized = {}
    for k, v in meta.items():
        if k.lower() in PHI_KEYS:
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_metadata(v)
        else:
            sanitized[k] = v
    return sanitized


async def audit(
    db: AsyncSession,
    action: AuditAction,
    entity_type: str,
    entity_id: Optional[str] = None,
    actor_user_id: Optional[uuid.UUID] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    clean_meta = sanitize_metadata(metadata)
    log_entry = AuditLog(
        id=uuid.uuid4(),
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        metadata_json=clean_meta,
    )
    db.add(log_entry)
    await db.flush()

    logger.info(
        "audit_event_logged",
        action=action.value,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        actor_user_id=str(actor_user_id) if actor_user_id else None,
    )
    return log_entry
