FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

# Shell form so ${PORT} expands: Render sets $PORT dynamically on free tier.
# Local docker runs still default to 8001 when PORT is unset.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}

