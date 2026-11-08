# =========================================================
# PulseCare 1-Click Startup Script (PowerShell)
# =========================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Starting PulseCare Full-Stack System   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 0. Sync Razorpay & Environment Configuration from application.yml to .env
Write-Host "`n[1/4] Syncing Razorpay keys from application.yml to .env..." -ForegroundColor Yellow
$syncScript = Join-Path $PSScriptRoot "scripts\sync-config.ps1"
if (Test-Path $syncScript) {
    powershell -NoProfile -ExecutionPolicy Bypass -File "$syncScript"
}

# 1. Start Docker Infrastructure (Postgres, Redis, Kafka, Debezium, AI-Service)
Write-Host "`n[2/4] Starting Docker infrastructure containers..." -ForegroundColor Yellow
$composeFile = Join-Path $PSScriptRoot "docker\docker-compose.yml"

docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Docker Desktop does not appear to be running. Please start Docker Desktop!" -ForegroundColor Red
} else {
    # Start backing services
    docker compose -f "$composeFile" up -d postgres redis kafka
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Postgres, Redis, and Kafka are up!" -ForegroundColor Green
    }
}

# 2. Start Full-Stack Backend and Microservices Container
Write-Host "`n[3/4] Starting Spring Boot Backend and microservices..." -ForegroundColor Yellow
docker compose -f "$composeFile" --profile full up -d backend ai-service debezium 2>$null

# Wait for backend health
Write-Host "Waiting for backend to become ready on port 8080..." -ForegroundColor Gray
$retries = 35
$healthy = $false
while ($retries -gt 0) {
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8080/actuator/health" -TimeoutSec 2 -ErrorAction Stop
        if ($res.status -eq "UP") {
            $healthy = $true
            break
        }
    } catch {
        Write-Host "." -NoNewline -ForegroundColor Gray
        Start-Sleep -Seconds 1
        $retries--
    }
}
Write-Host ""

if ($healthy) {
    Write-Host "Backend is UP and healthy on port 8080!" -ForegroundColor Green
} else {
    Write-Host "Backend is starting up in background." -ForegroundColor Yellow
}

# 3. Start Frontend (Vite) in a new terminal window
Write-Host "`n[4/4] Starting Frontend Dev Server..." -ForegroundColor Yellow
$frontendDir = Join-Path $PSScriptRoot "apps\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'PulseCare Frontend Server (Port 5173)' -ForegroundColor Cyan; Set-Location '$frontendDir'; npm run dev"

# 4. Optional background config watcher if available
if (Test-Path $syncScript) {
    Start-Process powershell -WindowStyle Minimized -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$syncScript`"", "-Watch"
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  PulseCare System is Live!                       " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  • Frontend:       http://localhost:5173" -ForegroundColor White
Write-Host "  • Backend:        http://localhost:8080" -ForegroundColor White
Write-Host "  • Swagger UI:     http://localhost:8080/swagger-ui.html" -ForegroundColor White
Write-Host "  • AI Service:     http://localhost:8001" -ForegroundColor White
Write-Host "  • Database:       localhost:5434 (PostgreSQL)" -ForegroundColor White
Write-Host "  • Cache:          localhost:6379 (Redis)" -ForegroundColor White
Write-Host "  • Event Bus:      localhost:9092 (Kafka)" -ForegroundColor White
Write-Host "  • CDC Connect:    localhost:8083 (Debezium)" -ForegroundColor White
Write-Host "`nTo stop all servers anytime, double-click: stop-all.bat (or run .\stop-all.ps1)" -ForegroundColor Cyan
Write-Host "To start all servers anytime, double-click: start-all.bat (or run .\start-all.ps1)" -ForegroundColor Cyan
