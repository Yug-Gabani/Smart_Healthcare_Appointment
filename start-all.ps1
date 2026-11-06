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
    powershell -ExecutionPolicy Bypass -File "$syncScript"
}

# 1. Start Docker Containers (Postgres, Redis, Kafka)
Write-Host "`n[2/4] Starting PostgreSQL, Redis, and Kafka containers..." -ForegroundColor Yellow
docker start healthcare-postgres healthcare-redis healthcare-kafka 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting via docker-compose..." -ForegroundColor Gray
    docker compose -f "$PSScriptRoot\docker\docker-compose.yml" up -d postgres redis kafka
}

# 2. Start Backend Container (Recreate to guarantee latest .env & YAML config)
Write-Host "`n[3/4] Starting Spring Boot Backend container with latest config..." -ForegroundColor Yellow
docker compose -f "$PSScriptRoot\docker\docker-compose.yml" --profile full up -d --force-recreate backend

# Wait for backend health
Write-Host "Waiting for backend to become ready on port 8080..." -ForegroundColor Gray
$retries = 45
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
    Write-Host "Backend is UP and ready on port 8080!" -ForegroundColor Green
} else {
    Write-Host "Backend container is running (still completing startup initialization)." -ForegroundColor Yellow
}

# 3. Start Frontend (Vite) in a new window
Write-Host "`n[4/4] Starting Frontend Dev Server..." -ForegroundColor Yellow
$frontendDir = Join-Path $PSScriptRoot "apps\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'PulseCare Frontend Server (Port 5173)' -ForegroundColor Cyan; Set-Location '$frontendDir'; npm run dev"

# 4. Start Background Config Watcher (Auto-syncs application.yml -> .env & reloads backend on save)
Start-Process powershell -WindowStyle Minimized -ArgumentList "-ExecutionPolicy", "Bypass", "-File", "`"$syncScript`"", "-Watch"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  PulseCare System is Live!             " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  • Frontend:      http://localhost:5173" -ForegroundColor White
Write-Host "  • Backend:       http://localhost:8080" -ForegroundColor White
Write-Host "  • Health:        http://localhost:8080/actuator/health" -ForegroundColor White
Write-Host "  • Database:      localhost:5432 (PostgreSQL)" -ForegroundColor White
Write-Host "  • Cache:         localhost:6379 (Redis)" -ForegroundColor White
Write-Host "  • Auto-Sync:     Active (changes in application.yml auto-sync to .env & reload)" -ForegroundColor White
Write-Host "`nTo change Razorpay keys anytime, just edit application.yml and run: .\sync-keys.ps1 or double-click sync-keys.bat" -ForegroundColor Cyan
Write-Host "To stop all servers anytime, run: .\stop-all.ps1 or double-click stop-all.bat" -ForegroundColor Cyan
