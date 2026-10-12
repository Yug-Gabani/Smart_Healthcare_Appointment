# Implements: FR-01, FR-02
# Safety:    S6, S7
# Owner:     backend (Group 6)

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.audit.helper import audit
from src.auth.security import create_access_token, get_password_hash, verify_password
from src.config import settings
from src.db.session import get_db
from src.models.audit import AuditAction
from src.models.user import User
from src.schemas.user import TokenResponse, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await audit(
        db=db,
        action=AuditAction.CREATE,
        entity_type="user",
        entity_id=str(user.id),
        actor_user_id=user.id,
        metadata={"role": user.role.value},
    )
    await db.commit()

    return user


@router.post("/login", response_model=TokenResponse)
async def login_user(
    payload: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(subject=str(user.id))

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.DEBUG,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    await audit(
        db=db,
        action=AuditAction.LOGIN,
        entity_type="user",
        entity_id=str(user.id),
        actor_user_id=user.id,
    )
    await db.commit()

    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
