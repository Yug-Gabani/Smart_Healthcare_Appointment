# Implements: NFR-03
# Safety:    none
# Owner:     infra (Group 6)

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml /app/

RUN pip install --no-cache-dir pip-tools
RUN pip install --no-cache-dir \
    fastapi==0.115.0 \
    "uvicorn[standard]==0.30.6" \
    sqlalchemy==2.0.35 \
    asyncpg==0.29.0 \
    alembic==1.13.3 \
    pydantic==2.9.2 \
    pydantic-settings==2.5.2 \
    "fastapi-users[sqlalchemy]==13.0.0" \
    "passlib[bcrypt]==1.7.4" \
    "python-jose[cryptography]==3.3.0" \
    sse-starlette==2.1.3 \
    arq==0.26.1 \
    httpx==0.27.2 \
    structlog==24.4.0 \
    boto3==1.35.36 \
    stripe==10.12.0 \
    sentry-sdk==2.14.0 \
    langchain==0.3.1 \
    langchain-core==0.3.1 \
    langchain-openai==0.2.1 \
    langgraph==0.2.28 \
    langgraph-checkpoint-postgres==1.0.0

COPY src/ /app/src/

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
