param(
  [string]$ComposeFile = "$PSScriptRoot\..\docker-compose.deploy.yml",
  [string]$JwtPrivateSrc = "$PSScriptRoot\..\secrets\jwt_private.pem",
  [string]$JwtPublicSrc = "$PSScriptRoot\..\secrets\jwt_public.pem"
)

Write-Host "Preparing deploy using compose file: $ComposeFile"

# Ensure secrets dir exists
$secretsDir = Join-Path $PSScriptRoot "..\secrets"
if (-not (Test-Path $secretsDir)) { New-Item -ItemType Directory -Path $secretsDir | Out-Null }

if (-not (Test-Path $JwtPrivateSrc)) {
  Write-Warning "Private key not found at $JwtPrivateSrc. Create or copy your jwt_private.pem to ./secrets/jwt_private.pem"
} else {
  Copy-Item -Force $JwtPrivateSrc $JwtPrivateSrc
}

if (-not (Test-Path $JwtPublicSrc)) {
  Write-Warning "Public key not found at $JwtPublicSrc. Create or copy your jwt_public.pem to ./secrets/jwt_public.pem"
} else {
  Copy-Item -Force $JwtPublicSrc $JwtPublicSrc
}

cd $PSScriptRoot\..

Write-Host "Building and starting containers (no-cache build)"
& docker-compose -f $ComposeFile build --no-cache
& docker-compose -f $ComposeFile up -d

Write-Host "Containers started. Use 'docker-compose -f $ComposeFile logs -f server' to follow logs."

