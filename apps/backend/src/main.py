# Implements: NFR-01, NFR-03, NFR-04
# Safety:    S7, S8
# Owner:     backend (zhsraD)

import sys
import uuid
from typing import Any
import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from collections.abc import MutableMapping

from src.api.admin import router as admin_router
from src.api.appointments import router as appointments_router
from src.api.audit import router as audit_router
from src.api.users import router as users_router
from src.config import settings

# Optional Sentry initialization
if getattr(settings, "SENTRY_DSN", None):
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.SENTRY_DSN, environment=settings.APP_ENV)
    except Exception:
        pass


# Configure structlog with PHI filter processor
def filter_phi_processor(
    logger: Any,
    log_method: str,
    event_dict: MutableMapping[str, Any],
) -> MutableMapping[str, Any]:
    phi_keys = {
        "name",
        "email",
        "phone",
        "address",
        "date_of_birth",
        "dob",
        "medical_history",
        "symptoms",
        "diagnosis",
        "password",
        "hashed_password",
        "access_token",
        "refresh_token",
    }

    for key in list(event_dict.keys()):
        if key.lower() in phi_keys:
            event_dict[key] = "[REDACTED]"

    return event_dict


structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        filter_phi_processor,
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
)

logger = structlog.get_logger()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def structlog_request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        path=request.url.path,
        method=request.method,
    )

    try:
        response = await call_next(request)
        logger.info(
            "http_request_finished",
            status_code=response.status_code,
        )
        return response
    except Exception as exc:
        logger.exception("unhandled_server_exception", error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )


# Health checks
@app.get("/health", tags=["health"])
@app.get("/api/health", tags=["health"])
async def health_check():
    return {"ok": True, "version": "0.1.0"}


# Mount Routers under API_V1_PREFIX
app.include_router(users_router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_router, prefix=settings.API_V1_PREFIX)
app.include_router(appointments_router, prefix=settings.API_V1_PREFIX)
app.include_router(audit_router, prefix=settings.API_V1_PREFIX)

# Also mount under /api for convenience
app.include_router(users_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
