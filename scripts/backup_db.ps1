param(
    [string]$OutputFile = "backup_$(Get-Date -Format yyyyMMdd_HHmmss).sql"
)

$command = "docker compose -f docker-compose.prod.yml exec db pg_dump -U buildshop buildshop"
Write-Host "Running backup command..."
Invoke-Expression $command | Out-File -FilePath $OutputFile -Encoding utf8
Write-Host "Backup saved to $OutputFile"

