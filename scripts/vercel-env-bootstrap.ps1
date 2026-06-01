<#
Idempotent Vercel env bootstrap script

Usage: run in project root where `npx vercel` is configured.
This prompts for required and optional env vars and sets them for `preview` by default.

Notes:
- Does NOT store secrets in this repo.
- Safe to re-run: existing values for the target environment are removed then re-added.
- If `npx vercel` is not installed, install Node.js and the Vercel CLI.
#>

function ConvertTo-UnsecureString($secure) {
    if ($null -eq $secure) { return $null }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Ensure-Command($cmd) {
    $c = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $c) {
        Write-Host "Could not find '$cmd' on PATH. Install Node.js and the Vercel CLI (npm i -g vercel) then re-run." -ForegroundColor Yellow
        exit 2
    }
}

function Prompt-For($name, $isSecret) {
    if ($isSecret) {
        $s = Read-Host -Prompt "Enter value for $name (will be hidden) or press Enter to skip" -AsSecureString
        $val = ConvertTo-UnsecureString $s
    } else {
        $val = Read-Host -Prompt "Enter value for $name (or press Enter to skip)"
    }
    if ($val -eq "") { return $null }
    return $val
}

function Exists-Env($name, $env) {
    $ls = & npx vercel env ls 2>&1
    if ($LASTEXITCODE -ne 0) { return $false }
    # crude check: look for the var name and the environment word on the same line
    foreach ($line in $ls) {
        if ($line -match "^\s*$name\b" -and $line -match "\b$env\b") { return $true }
    }
    return $false
}

function Remove-EnvIfExists($name, $env) {
    if (Exists-Env $name $env) {
        Write-Host "Removing existing $name for $env"
        & npx vercel env rm $name $env --yes
    }
}

function Add-Env($name, $value, $env) {
    if ($null -eq $value) { return }
    # remove existing then add new value (makes the script idempotent)
    Remove-EnvIfExists $name $env
    Write-Host "Adding $name to $env"
    # pipe the value into the interactive prompt
    $value | npx vercel env add $name $env
}

function Add-Env-For-Environments($name, $value, $environments) {
    foreach ($env in $environments) {
        Add-Env $name $value $env
    }
}

Ensure-Command npx

Write-Host "This script will add Vercel environment variables for the current project." -ForegroundColor Cyan
Write-Host "Target environment: preview (you may opt-in to production per-variable)." -ForegroundColor Cyan

$required = @(
    @{ name = 'ADMIN_TOKEN'; secret = $true },
    @{ name = 'SITE_URL'; secret = $false },
    @{ name = 'SUPABASE_URL'; secret = $false },
    @{ name = 'SUPABASE_KEY'; secret = $true }
)

$optional = @(
    @{ name = 'RESEND_API_KEY'; secret = $true },
    @{ name = 'SENDGRID_API_KEY'; secret = $true }
)

$toSet = @()

Write-Host "\n--- Required variables ---" -ForegroundColor Green
foreach ($item in $required) {
    $val = Prompt-For $($item.name) $($item.secret)
    if ($null -ne $val) { $toSet += @{ name = $item.name; value = $val; secret = $item.secret } }
}

Write-Host "\n--- Optional variables (press Enter to skip) ---" -ForegroundColor Green
foreach ($item in $optional) {
    $val = Prompt-For $($item.name) $($item.secret)
    if ($null -ne $val) { $toSet += @{ name = $item.name; value = $val; secret = $item.secret } }
}

if ($toSet.Count -eq 0) {
    Write-Host "No variables entered. Exiting." -ForegroundColor Yellow
    exit 0
}

# Ask whether to also set in production
$setProd = Read-Host -Prompt "Also set these variables in 'production' after preview? (y/N)"
$environments = @('preview')
if ($setProd -match '^(y|Y)') { $environments += 'production' }

Write-Host "\nAbout to set the following variables for: $($environments -join ', ')" -ForegroundColor Cyan
foreach ($v in $toSet) { Write-Host " - $($v.name)" }

$confirm = Read-Host -Prompt "Proceed? (y/N)"
if (-not ($confirm -match '^(y|Y)')) { Write-Host "Aborted by user." -ForegroundColor Yellow; exit 0 }

foreach ($v in $toSet) {
    foreach ($env in $environments) {
        Add-Env $v.name $v.value $env
    }
}

Write-Host "\nAll environment variables processed." -ForegroundColor Green

$redeploy = Read-Host -Prompt "Redeploy to create a new preview deployment now? (y/N)"
if ($redeploy -match '^(y|Y)') {
    Write-Host "Deploying with: npx vercel --yes" -ForegroundColor Cyan
    npx vercel --yes
    if ($LASTEXITCODE -eq 0) { Write-Host "Deploy triggered." -ForegroundColor Green } else { Write-Host "Deploy failed or was interrupted." -ForegroundColor Red }
} else {
    Write-Host "Skipped redeploy. To deploy manually run: npx vercel --yes" -ForegroundColor Cyan
}

Write-Host "Done. If you set secrets, they will be available to your deployments after the deploy finishes." -ForegroundColor Green
