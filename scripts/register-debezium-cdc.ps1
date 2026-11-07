# =========================================================
# Debezium CDC Connector Registration Script (PowerShell)
# =========================================================
param (
    [string]$DebeziumHost = "http://localhost:8083"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Registering Debezium PostgreSQL CDC   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$connectorConfig = @{
    name = "healthcare-outbox-connector"
    config = @{
        "connector.class" = "io.debezium.connector.postgresql.PostgresConnector"
        "tasks.max" = "1"
        "plugin.name" = "pgoutput"
        "database.hostname" = "postgres"
        "database.port" = "5432"
        "database.user" = "healthcare"
        "database.password" = "healthcare"
        "database.dbname" = "healthcare"
        "table.include.list" = "public.payment_outbox"
        "topic.prefix" = "healthcare_cdc"
        "tombstones.on.delete" = "false"
        "schema.history.internal.kafka.bootstrap.servers" = "kafka:29092"
        "schema.history.internal.kafka.topic" = "schema-changes.healthcare"
    }
} | ConvertTo-Json -Depth 5

try {
    $uri = "$DebeziumHost/connectors"
    Write-Host "Posting configuration to $uri..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $uri -Method Post -Body $connectorConfig -ContentType "application/json" -TimeoutSec 10
    Write-Host "Debezium CDC Connector registered successfully!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Warning "Debezium Connect registration: $_"
}

