#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo " Starting PulseCare Full-Stack Platform   "
echo "=========================================="

# 1. Start Docker Containers (Postgres, Redis)
echo "[1/4] Starting PostgreSQL & Redis via Docker..."
if command -v docker &> /dev/null; then
    docker compose -f docker/docker-compose.yml up -d postgres redis
else
    echo "Notice: Docker CLI not found or managed externally. Ensure PostgreSQL (5432) & Redis (6379) are running."
fi

# Cleanup handler for graceful shutdown
cleanup() {
    echo ""
    echo "Shutting down local services..."
    [ -n "$AI_PID" ] && kill "$AI_PID" 2>/dev/null || true
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
    echo "Services stopped cleanly."
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 2. Start AI Service (FastAPI + LangChain on port 8001)
echo "[2/4] Starting AI Service on http://localhost:8001..."
(
    cd "$PROJECT_ROOT/apps/ai-service"
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    exec uvicorn main:app --host 0.0.0.0 --port 8001 --reload
) &
AI_PID=$!

# 3. Start Spring Boot Backend on port 8080
echo "[3/4] Starting Spring Boot Backend on http://localhost:8080..."
(
    cd "$PROJECT_ROOT/apps/backend"
    exec ./mvnw spring-boot:run
) &
BACKEND_PID=$!

# 4. Start Frontend (Vite) on port 5173
echo "[4/4] Starting Frontend Dev Server on http://localhost:5173..."
(
    cd "$PROJECT_ROOT/apps/frontend"
    exec npm run dev
) &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo " PulseCare is running!"
echo " Frontend:   http://localhost:5173"
echo " Backend:    http://localhost:8080"
echo " AI Service: http://localhost:8001"
echo " Press Ctrl+C to terminate all services."
echo "=========================================="

wait

