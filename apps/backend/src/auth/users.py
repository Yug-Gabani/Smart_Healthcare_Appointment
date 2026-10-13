# Implements: FR-01, FR-02
# Safety:    S8
# Owner:     backend (zhsraD)

import uuid
from fastapi_users import FastAPIUsers
from src.auth.backend import auth_backend, bearer_backend
from src.auth.manager import get_user_manager
from src.models.user import User

fastapi_users = FastAPIUsers[User, uuid.UUID](
    get_user_manager,
    [bearer_backend, auth_backend],
)

current_active_user = fastapi_users.current_user(active=True)
