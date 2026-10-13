# Implements: NFR-03, NFR-04
# Safety:    S7, S8
# Owner:     backend (Group 6)

import uuid
from typing import List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.deps import require_role
from src.models.audit import AuditAction, AuditLog
from src.models.user import Role, User

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    timestamp: str
    actor_user_id: str | None
    action: AuditAction
    entity_type: str
    entity_id: str | None
    metadata_json: dict

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=List[AuditLogResponse])
async def get_audit_trail(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=log.id,
            timestamp=log.timestamp.isoformat(),
            actor_user_id=str(log.actor_user_id) if log.actor_user_id else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            metadata_json=log.metadata_json,
        )
        for log in logs
    ]
