param (
    [switch]$RestartBackend,
    [switch]$Watch
)

$rootDir = Split-Path -Parent $PSScriptRoot
$ymlPath = Join-Path $rootDir "apps\backend\src\main\resources\application.yml"
$envPath = Join-Path $rootDir "apps\backend\.env"

function Sync-Config {
    if (-not (Test-Path $ymlPath)) {
        Write-Warning "application.yml not found at: $ymlPath"
        return $false
    }

    $ymlContent = Get-Content -Path $ymlPath -Raw
    $keyId = $null
    $keySecret = $null
    $mailPass = $null
    $mailUser = $null

    # Extract razorpay block
    if ($ymlContent -match '(?ms)^\s*razorpay:\s*(.+?)(?=\n[a-zA-Z0-9_-]+:|\z)') {
        $rzpBlock = $Matches[1]
        if ($rzpBlock -match '(?m)^\s*key-id\s*:\s*(?:["'']?)(?:(?:\$\{[^:]+:(?<val>[^}]+)\})|(?<val>[^"''\s#\r\n]+))(?:["'']?)') {
            $rawId = $Matches['val'].Trim()
            $keyId = ($rawId -split '#')[0].Trim().Trim('"').Trim("'")
        }
        if ($rzpBlock -match '(?m)^\s*key-secret\s*:\s*(?:["'']?)(?:(?:\$\{[^:]+:(?<val>[^}]+)\})|(?<val>[^"''\s#\r\n]+))(?:["'']?)') {
            $rawSecret = $Matches['val'].Trim()
            $keySecret = ($rawSecret -split '#')[0].Trim().Trim('"').Trim("'")
        }
    }

    # Extract mail block
    $mailPattern = '(?ms)^\s*mail:\s*(.+?)(?=\n\s{2}[a-zA-Z0-9_-]+:|\n[a-zA-Z0-9_-]+:|\z)'
    if ($ymlContent -match $mailPattern) {
        $mailBlock = $Matches[1]
        if ($mailBlock -match '(?m)^\s*username\s*:\s*(?:["'']?)(?:(?:\$\{[^:]+:(?<val>[^}]+)\})|(?<val>[^"''\s#\r\n]+))(?:["'']?)') {
            $mailUser = $Matches['val'].Trim()
        }
        if ($mailBlock -match '(?m)^\s*password\s*:\s*(?:["'']?)(?:(?:\$\{[^:]+:(?<val>[^}]+)\})|(?<val>[^"''\s#\r\n]+))(?:["'']?)') {
            $mailPass = $Matches['val'].Trim()
        }
    }

    if (-not $keyId -or -not $keySecret) {
        Write-Warning "Could not find razorpay.key-id or razorpay.key-secret in $ymlPath"
        return $false
    }

    # Ensure apps/backend/.env exists
    if (-not (Test-Path $envPath)) {
        New-Item -ItemType File -Path $envPath -Force | Out-Null
    }

    $envContent = Get-Content -Path $envPath -Raw -ErrorAction SilentlyContinue
    if ($null -eq $envContent) { $envContent = "" }

    # Helper function to update or insert env var
    function Set-EnvVar ($name, $val) {
        if ($null -eq $val -or $val -eq "") { return }
        $pattern = "(?m)^$name=.*$"
        if ($script:envContent -match $pattern) {
            $script:envContent = [regex]::Replace($script:envContent, $pattern, "$name=$val")
        } else {
            $script:envContent = "$name=$val`n" + $script:envContent
        }
    }

    $script:envContent = $envContent
    Set-EnvVar "RAZORPAY_KEY_ID" $keyId
    Set-EnvVar "RAZORPAY_KEY_SECRET" $keySecret
    if ($mailPass) { Set-EnvVar "MAIL_PASSWORD" $mailPass }
    if ($mailUser) { Set-EnvVar "MAIL_USERNAME" $mailUser }

    [System.IO.File]::WriteAllText($envPath, $script:envContent, [System.Text.Encoding]::UTF8)

    Write-Host "[CONFIG SYNC] Synced from application.yml to .env:" -ForegroundColor Green
    Write-Host "              • RAZORPAY_KEY_ID     = $keyId" -ForegroundColor Cyan
    Write-Host "              • RAZORPAY_KEY_SECRET = $($keySecret.Substring(0, [Math]::Min(6, $keySecret.Length)))..." -ForegroundColor Cyan
    if ($mailUser) { Write-Host "              • MAIL_USERNAME       = $mailUser" -ForegroundColor Cyan }

    return $true
}

# Run initial sync
$synced = Sync-Config

if ($RestartBackend -and $synced) {
    Write-Host "[CONFIG SYNC] Recreating/Restarting healthcare-backend container..." -ForegroundColor Yellow
    docker compose -f "$rootDir\docker\docker-compose.yml" --profile full up -d --no-deps --force-recreate backend 2>$null
    if ($LASTEXITCODE -ne 0) {
        docker restart healthcare-backend 2>$null
    }
    Write-Host "[CONFIG SYNC] Backend container updated with new credentials!" -ForegroundColor Green
}

if ($Watch) {
    Write-Host "`n[CONFIG WATCHER] Watching for changes to application.yml..." -ForegroundColor Cyan
    Write-Host "                 Press Ctrl+C to stop watching.`n" -ForegroundColor Gray

    $folder = Split-Path -Parent $ymlPath
    $file = Split-Path -Leaf $ymlPath

    $watcher = New-Object System.IO.FileSystemWatcher
    $watcher.Path = $folder
    $watcher.Filter = $file
    $watcher.IncludeSubdirectories = $false
    $watcher.EnableRaisingEvents = $true
    $watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::Size

    $lastChange = [DateTime]::MinValue

    $action = {
        $now = [DateTime]::Now
        if (($now - $lastChange).TotalMilliseconds -gt 1000) {
            $global:lastChange = $now
            Start-Sleep -Milliseconds 200
            Write-Host "`n[CONFIG WATCHER] Change detected in application.yml at $($now.ToString('HH:mm:ss'))!" -ForegroundColor Magenta
            Sync-Config
            Write-Host "[CONFIG WATCHER] Recreating healthcare-backend container with latest keys..." -ForegroundColor Yellow
            docker compose -f "$rootDir\docker\docker-compose.yml" --profile full up -d --no-deps --force-recreate backend 2>$null
            if ($LASTEXITCODE -ne 0) {
                docker restart healthcare-backend 2>$null
            }
            Write-Host "[CONFIG WATCHER] Backend reloaded with latest keys!" -ForegroundColor Green
        }
    }

    Register-ObjectEvent $watcher 'Changed' -Action $action | Out-Null

    try {
        while ($true) {
            Start-Sleep -Seconds 1
        }
    } finally {
        $watcher.EnableRaisingEvents = $false
        $watcher.Dispose()
    }
}
