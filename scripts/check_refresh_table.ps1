param(
  [string]$PgConn = $env:SUPABASE_DB_URL
)

if (-not $PgConn) {
  Write-Error "Postgres connection string missing. Set SUPABASE_DB_URL or pass -PgConn"
  exit 1
}

Write-Host "Checking refresh_tokens table..."
& psql $PgConn -c "SELECT to_regclass('public.refresh_tokens') as exists, (SELECT COUNT(*) FROM public.refresh_tokens) as rows;"

