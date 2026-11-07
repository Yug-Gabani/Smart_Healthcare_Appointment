# Package PulseCare Codebase into a clean, lightweight ZIP for sharing via WhatsApp
$ErrorActionPreference = 'Stop'

$desktopPath = [Environment]::GetFolderPath("Desktop")
$zipFileName = "PulseCare-Healthcare-Codebase.zip"
$zipDest = Join-Path $desktopPath $zipFileName
$localZipDest = Join-Path (Get-Location) $zipFileName
$staging = Join-Path $env:TEMP "PulseCare-Clean-Staging-$(Get-Random)"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Packaging Updated PulseCare Codebase for WhatsApp Sharing" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Remove old zips if present
if (Test-Path $zipDest) {
    Remove-Item -Force $zipDest -ErrorAction SilentlyContinue
}
if (Test-Path $localZipDest) {
    Remove-Item -Force $localZipDest -ErrorAction SilentlyContinue
}
if (Test-Path $staging) {
    Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
}

Write-Host "`n1. Copying clean source files (excluding node_modules, target, .git, temp files)..." -ForegroundColor Yellow
robocopy . $staging /E /XD node_modules target dist .git .vscode .gemini .idea .system_generated .user_uploaded uploads /XF *.log *.jar.original *.zip *.tar *.gz /NP /NDL /NFL /NJH /NJS
if ($LASTEXITCODE -ge 8) {
    throw "Robocopy encountered an error (exit code $LASTEXITCODE)"
}

Write-Host "`n2. Compressing clean archive to Desktop and Project root..." -ForegroundColor Yellow
Compress-Archive -Path "$staging\*" -DestinationPath $zipDest -Force

# Also copy a duplicate directly to current project folder for easy access
Copy-Item $zipDest -Destination $localZipDest -Force

Write-Host "`n3. Cleaning temporary staging folder..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue

$file = Get-Item $zipDest
$sizeMb = [math]::Round($file.Length / 1MB, 2)
$sizeKb = [math]::Round($file.Length / 1KB, 1)

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " SUCCESS: Codebase packaged cleanly!" -ForegroundColor Green
Write-Host " Archive location (Desktop): $zipDest" -ForegroundColor White
Write-Host " Archive location (Project): $localZipDest" -ForegroundColor White
Write-Host " File Size: $sizeMb MB ($sizeKb KB)" -ForegroundColor Yellow
Write-Host " Ready to attach and send as a Document in WhatsApp!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
