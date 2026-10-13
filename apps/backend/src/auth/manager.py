# Implements: FR-01, FR-02
# Safety:    S6, S7
# Owner:     backend (zhsraD)

import uuid
from typing import Optional
from fastapi import Depends, Request
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

# pyrefly: ignore [missing-import]
from src.audit.helper import audit
# pyrefly: ignore [missing-import]
from src.config import settings
# pyrefly: ignore [missing-import]
from src.db.session import get_db
# pyrefly: ignore [missing-import]
from src.models.user import User


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.AUTH_SECRET
    verification_token_secret = settings.AUTH_SECRET

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        ip = request.client.host if request and request.client else None
        ua = request.headers.get("user-agent") if request else None
        session = getattr(self.user_db, "session", None)
        await audit(
            session=session,
            action="REGISTER",
            entity_type="user",
            entity_id=str(user.id),
            actor_user_id=user.id,
            metadata={
                "role": (
                    user.role.value if hasattr(user.role, "value") else str(user.role)
                )
            },
            ip=ip,
            user_agent=ua,
        )

    async def on_after_login(
        self,
        user: User,
        request: Optional[Request] = None,
        response: Optional[Any] = None,
    ):
        ip = request.client.host if request and request.client else None
        ua = request.headers.get("user-agent") if request else None
        session = getattr(self.user_db, "session", None)
        await audit(
            session=session,
            action="LOGIN",
            entity_type="user",
            entity_id=str(user.id),
            actor_user_id=user.id,
            ip=ip,
            user_agent=ua,
        )


async def get_user_db(session: AsyncSession = Depends(get_db)):
    yield SQLAlchemyUserDatabase(session, User)


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)
