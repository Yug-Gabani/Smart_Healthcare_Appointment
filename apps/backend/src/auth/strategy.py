# Implements: NFR-01, NFR-03
# Safety:    none
# Owner:     backend (zhsraD)

from fastapi_users.authentication import JWTStrategy
from src.config import settings


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.AUTH_SECRET,
        lifetime_seconds=settings.ACCESS_TOKEN_TTL_MINUTES * 60,
    )
