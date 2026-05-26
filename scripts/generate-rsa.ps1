param(
    [int]$Bits = 2048,
    [string]$OutDir = (Resolve-Path "..").ProviderPath
)

# Generates PKCS#8 private key and SubjectPublicKeyInfo public key in PEM format.
# Requires PowerShell 7 / .NET Core for ExportPkcs8PrivateKey & ExportSubjectPublicKeyInfo.

Write-Host "Generating $Bits-bit RSA keypair into: $OutDir"

$rsa = [System.Security.Cryptography.RSA]::Create($Bits)

# Ensure we are running on .NET Core / PowerShell 7 where ExportPkcs8PrivateKey exists
if (-not $rsa.GetType().GetMethod('ExportPkcs8PrivateKey')) {
    Write-Error "This script requires PowerShell 7 / .NET Core (pwsh). The current PowerShell does not expose ExportPkcs8PrivateKey / ExportSubjectPublicKeyInfo.\nPlease run this script with PowerShell 7 (pwsh) or use OpenSSL/WSL/ Git Bash."
    exit 1
}

# Export keys
$privateBytes = $rsa.ExportPkcs8PrivateKey()
$publicBytes  = $rsa.ExportSubjectPublicKeyInfo()

# Convert to PEM (base64 with 64-char lines)
function To-Pem([byte[]]$bytes, [string]$header, [string]$footer) {
    $b64 = [Convert]::ToBase64String($bytes)
    $lines = ($b64 -split '(.{64})' | Where-Object { $_ -ne '' }) -join "`n"
    return "$header`n$lines`n$footer`n"
}

$privPem = To-Pem $privateBytes "-----BEGIN PRIVATE KEY-----" "-----END PRIVATE KEY-----"
$pubPem  = To-Pem $publicBytes  "-----BEGIN PUBLIC KEY-----"  "-----END PUBLIC KEY-----"

$privPath = Join-Path $OutDir 'jwt_private.pem'
$pubPath  = Join-Path $OutDir 'jwt_public.pem'

[System.IO.File]::WriteAllText($privPath, $privPem)
[System.IO.File]::WriteAllText($pubPath,  $pubPem)

# Create single-line base64 (no line breaks) for env vars
$privB64Nowrap = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($privPath))
$pubB64Nowrap  = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($pubPath))

Write-Host "Wrote files:
  $privPath
  $pubPath"

Write-Host "\nSingle-line base64 (use these for JWT_PRIVATE_KEY_B64 / JWT_PUBLIC_KEY_B64):\n" -ForegroundColor Yellow
Write-Host "JWT_PRIVATE_KEY_B64=$privB64Nowrap" -ForegroundColor Green
Write-Host "JWT_PUBLIC_KEY_B64=$pubB64Nowrap" -ForegroundColor Green

Write-Host "\nSafety notes: do NOT commit $privPath to git. Store the private key in a secrets manager or add it to .gitignore."

# Suggest setting filesystem permissions (best-effort on Windows)
try {
    if ($IsWindows) {
        Write-Host "Attempting to restrict file ACLs to current user (Windows)..."
        $username = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        icacls $privPath /inheritance:r | Out-Null
        icacls $privPath /grant:r "$username:R" | Out-Null
        Write-Host "Restricted $privPath to $username"
    } else {
        chmod 600 $privPath | Out-Null
        Write-Host "Set mode 600 on $privPath"
    }
} catch {
    Write-Warning "Failed to change file permissions automatically: $_"
}

Write-Host "Done. If you need, run this script with -Bits 3072 or 4096 for stronger keys."
