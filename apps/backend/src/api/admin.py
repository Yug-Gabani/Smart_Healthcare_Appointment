# Implements: FR-35
# Safety:    S8
# Owner:     backend (zhsraD)

from fastapi import APIRouter, Depends
# pyrefly: ignore [missing-import]
from src.deps import require_role
# pyrefly: ignore [missing-import]
from src.models.user import Role, User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/ping")
async def admin_ping(
    current_user: User = Depends(require_role(Role.CLINIC_ADMIN, Role.SYSTEM_ADMIN)),
):
    return {"ok": True, "actor": str(current_user.id)}
