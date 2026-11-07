# =========================================================
# PulseCare 1-Click Shutdown Script (PowerShell)
# =========================================================
Write-Host "========================================" -ForegroundColor Yellow
Write-Host " Stopping PulseCare Full-Stack System   " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# 1. Stop Frontend Vite dev server listening on port 5173
Write-Host "`n[1/2] Stopping Frontend Dev Server (port 5173)..." -ForegroundColor Yellow
try {
    $conns = Get-NetTCPConnection -LocalPort 5173, 8080 -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped process ID $($c.OwningProcess) on port 5173" -ForegroundColor Gray
        }
    } else {
        Write-Host "Frontend server is already stopped." -ForegroundColor Gray
    }
} catch {
    # Ignore errors if port not in use
}

# 2. Stop Docker Containers (Backend, Postgres, Redis)
Write-Host "`n[2/2] Stopping Docker Containers (healthcare-backend, postgres, redis)..." -ForegroundColor Yellow
docker stop healthcare-backend healthcare-postgres healthcare-redis healthcare-kafka 2>$null

Write-Host "`n========================================" -ForegroundColor Green
Write-Host " All PulseCare servers stopped cleanly! " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "To start everything again, run: .\start-all.ps1 or double-click start-all.bat" -ForegroundColor Cyan
