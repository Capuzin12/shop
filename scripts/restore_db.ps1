param(
    [Parameter(Mandatory = $true)]
    [string]$InputFile
)

if (-not (Test-Path $InputFile)) {
    throw "Backup file not found: $InputFile"
}

Write-Host "Restoring database from $InputFile ..."
Get-Content $InputFile -Raw | docker compose -f docker-compose.prod.yml exec -T db psql -U buildshop -d buildshop
Write-Host "Restore completed."

