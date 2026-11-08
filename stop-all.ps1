# =========================================================
# PulseCare 1-Click Shutdown Script (PowerShell)
# =========================================================
Write-Host "========================================" -ForegroundColor Yellow
Write-Host " Stopping PulseCare Full-Stack System   " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# 1. Stop Frontend & Local Dev Servers (port 5173, 8080, 8001)
Write-Host "`n[1/2] Stopping local Frontend and Dev Server processes..." -ForegroundColor Yellow
try {
    $ports = @(5173, 8080, 8001)
    foreach ($port in $ports) {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Host "  • Stopped process $($c.OwningProcess) listening on port $port" -ForegroundColor Gray
            }
        }
    }
} catch {
    # Ignore errors if ports are free
}

# 2. Stop All PulseCare Docker Containers
Write-Host "`n[2/2] Stopping Docker Containers..." -ForegroundColor Yellow
$containers = @(
    "healthcare-backend",
    "healthcare-ai-service",
    "healthcare-debezium",
    "healthcare-kafka",
    "healthcare-redis",
    "healthcare-postgres"
)

foreach ($c in $containers) {
    docker stop $c 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  • Stopped container: $c" -ForegroundColor Green
    }
}

# Ensure compose teardown
$composeFile = Join-Path $PSScriptRoot "docker\docker-compose.yml"
if (Test-Path $composeFile) {
    docker compose -f "$composeFile" --profile full stop 2>$null | Out-Null
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host " All PulseCare servers stopped cleanly! " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "To start everything again, run: .\start-all.ps1 or double-click start-all.bat" -ForegroundColor Cyan
