# =====================================================================
# PulseCare Key Sync: application.yml -> .env -> reload backend
# =====================================================================
param(
    [switch]$Watch
)

if ($Watch) {
    & "$PSScriptRoot\scripts\sync-config.ps1" -Watch
} else {
    & "$PSScriptRoot\scripts\sync-config.ps1" -RestartBackend
}

