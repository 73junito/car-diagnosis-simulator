Write-Host "This script helps add OLLAMA Access secrets to the staging Worker using wrangler." -ForegroundColor Cyan

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Error "npx is not available in PATH. Install Node.js and npm or run these commands manually."
    exit 1
}

$envName = Read-Host "Target wrangler environment (default: staging)"
if ([string]::IsNullOrWhiteSpace($envName)) { $envName = 'staging' }

# Prompt for Client ID
$ClientId = Read-Host "Paste Cloudflare Access Client ID (OLLAMA_ACCESS_CLIENT_ID)"
if (-not $ClientId) { Write-Error "No client id provided; aborting."; exit 1 }

Write-Host "Uploading OLLAMA_ACCESS_CLIENT_ID to Worker environment '$envName'..." -ForegroundColor Yellow
$ClientId | npx wrangler secret put OLLAMA_ACCESS_CLIENT_ID --env $envName
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to upload OLLAMA_ACCESS_CLIENT_ID"; exit 1 }

# Prompt for Client Secret as secure string
$Secure = Read-Host "Paste Cloudflare Access Client Secret (OLLAMA_ACCESS_CLIENT_SECRET)" -AsSecureString
$ClientSecret = [System.Net.NetworkCredential]::new('', $Secure).Password
if (-not $ClientSecret) { Write-Error "No client secret provided; aborting."; exit 1 }

Write-Host "Uploading OLLAMA_ACCESS_CLIENT_SECRET to Worker environment '$envName'..." -ForegroundColor Yellow
$ClientSecret | npx wrangler secret put OLLAMA_ACCESS_CLIENT_SECRET --env $envName
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to upload OLLAMA_ACCESS_CLIENT_SECRET"; exit 1 }

Write-Host "Secrets uploaded. Listing secrets for verification:" -ForegroundColor Green
npx wrangler secret list --env $envName

Write-Host "Done. Remember to remove any temporary copies of the secrets from your shell history or clipboard." -ForegroundColor Cyan