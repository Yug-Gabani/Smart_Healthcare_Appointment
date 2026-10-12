# Implements: NFR-03, NFR-04
# Safety:    S7, S10
# Owner:     backend (Group 6)

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Healthcare Appointment & Triage System"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Database & Redis (Matching docker-compose host port bindings)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5433/smart_healthcare"
    REDIS_URL: str = "redis://localhost:6380/0"

    # JWT Authentication
    JWT_SECRET: str = "supersecretjwtkeyforstudentprojecteval1234567890"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # MinIO / S3
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadminpassword"
    S3_BUCKET_NAME: str = "healthcare-documents"
    S3_REGION: str = "us-east-1"

    # AI & OpenRouter
    OPENROUTER_API_KEY: str = "test-openrouter-key"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    AI_MODEL: str = "anthropic/claude-3.5-sonnet"

    # Stripe & External
    STRIPE_API_KEY: str = "sk_test_placeholder"
    STRIPE_WEBHOOK_SECRET: str = "whsec_placeholder"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
