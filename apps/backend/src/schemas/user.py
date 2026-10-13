# Implements: FR-01, FR-02
# Safety:    none
# Owner:     backend (zhsraD)

import uuid
from datetime import datetime
from typing import Optional

from fastapi_users import schemas
from pydantic import BaseModel, ConfigDict, EmailStr

from src.models.user import Role


class UserRead(schemas.BaseUser[uuid.UUID]):
    name: str = ""
    role: Role = Role.PATIENT
    email_verified_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserCreate(schemas.BaseUserCreate):
    name: str = ""
    role: Role = Role.PATIENT


class UserUpdate(schemas.BaseUserUpdate):
    name: Optional[str] = None
    role: Optional[Role] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str = ""
    role: Role
    is_active: bool
    is_verified: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
