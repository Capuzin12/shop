# PowerShell script to apply a Supabase SQL migration file using psql
param(
  [string]$PgConn = $env:SUPABASE_DB_URL,
  [string]$MigrationFile = "$PSScriptRoot\..\supabase\migrations\20260526_add_refresh_tokens.sql"
)

if (-not $PgConn) {
  Write-Error "Postgres connection string is not provided. Set SUPABASE_DB_URL env or pass -PgConn"
  exit 1
}

if (-not (Test-Path $MigrationFile)) {
  Write-Error "Migration file not found: $MigrationFile"
  exit 1
}

Write-Host "Applying Supabase migration: $MigrationFile to $PgConn"

# Execute with psql; user must have psql in PATH
& psql $PgConn -f $MigrationFile

