# Implements: NFR-01, NFR-03
# Safety:    none
# Owner:     backend (zhsraD)

from fastapi_users.authentication import AuthenticationBackend, BearerTransport, CookieTransport
from src.auth.strategy import get_jwt_strategy
from src.config import settings

cookie_transport = CookieTransport(
    cookie_name="pulse_refresh",
    cookie_max_age=settings.REFRESH_TOKEN_TTL_DAYS * 86400,
    cookie_secure=settings.APP_ENV == "production",
    cookie_httponly=True,
    cookie_samesite="lax",
)

bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

auth_backend = AuthenticationBackend(
    name="jwt_cookie",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)

bearer_backend = AuthenticationBackend(
    name="jwt_bearer",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)
