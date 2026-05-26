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

# psql expects a libpq-style URL, not SQLAlchemy dialect suffix
$PgConnForPsql = $PgConn -replace '^postgresql\+psycopg://', 'postgresql://'

Write-Host "Applying Supabase migration: $MigrationFile to $PgConnForPsql"

# If psql CLI is available, use it; otherwise try dockerized psql
if (Get-Command psql -ErrorAction SilentlyContinue) {
  Write-Host "Using local psql client"
  & psql $PgConnForPsql -f $MigrationFile
} else {
  Write-Warning "psql CLI not found locally. Falling back to dockerized psql (requires Docker)."
  $absMigration = (Resolve-Path $MigrationFile).ProviderPath
  $mountDir = Split-Path $absMigration -Parent
  $fileName = Split-Path $absMigration -Leaf
  Write-Host "Mounting $mountDir into container and executing migration $fileName"
  $dockerCmd = "docker run --rm -v `"$mountDir`":/migrations postgres:15-alpine psql `"$PgConnForPsql`" -f /migrations/$fileName"
  Write-Host $dockerCmd
  iex $dockerCmd
}

