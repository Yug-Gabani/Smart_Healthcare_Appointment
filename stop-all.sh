#!/usr/bin/env bash

echo "=========================================="
echo " Stopping PulseCare Full-Stack System     "
echo "=========================================="

# 1. Kill any processes listening on ports 5173, 8080, 8001
for port in 5173 8080 8001; do
    pid=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo "Stopping process $pid on port $port..."
        kill -9 $pid 2>/dev/null || true
    fi
done

# 2. Stop Docker Containers if docker is available
if command -v docker &> /dev/null; then
    echo "Stopping Docker containers..."
    docker stop healthcare-backend healthcare-postgres healthcare-redis healthcare-kafka 2>/dev/null || true
fi

echo "=========================================="
echo " All PulseCare services stopped cleanly! "
echo "=========================================="

