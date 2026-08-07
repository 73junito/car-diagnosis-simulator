$ErrorActionPreference = "Stop"

function ConvertTo-PlainText([Security.SecureString]$SecureValue) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
  }
}

Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  $Candidates = @(
    "C:\Program Files\PostgreSQL\18\bin",
    "C:\Program Files\PostgreSQL\17\bin"
  )

  foreach ($Candidate in $Candidates) {
    if (Test-Path (Join-Path $Candidate "psql.exe")) {
      $env:Path = "$Candidate;$env:Path"
      break
    }
  }
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql is not installed or not in PATH."
}

$DatabaseHost = Read-Host "Host"
$DatabasePort = Read-Host "Port [5432]"
if ([string]::IsNullOrWhiteSpace($DatabasePort)) {
  $DatabasePort = "5432"
}
$DatabaseName = Read-Host "Database [postgres]"
if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
  $DatabaseName = "postgres"
}
$DatabaseUser = Read-Host "User"
$DatabasePassword = Read-Host "Password" -AsSecureString

Write-Host "Running preflight connection test..."
$env:PGPASSWORD = ConvertTo-PlainText $DatabasePassword
try {
  $env:PGSSLMODE = "require"
  psql -h $DatabaseHost -p $DatabasePort -U $DatabaseUser -d $DatabaseName -v ON_ERROR_STOP=1 -c "select 1;" | Out-Null
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
}
if ($LASTEXITCODE -ne 0) {
  throw "Preflight connection test failed."
}
Write-Host "Preflight succeeded. Running exports..."

try {
  .\scripts\export-rala-baseline.ps1 `
    -DatabaseHost $DatabaseHost `
    -DatabasePort $DatabasePort `
    -DatabaseName $DatabaseName `
    -DatabaseUser $DatabaseUser `
    -DatabasePassword $DatabasePassword
} catch {
  if ($_.Exception.Message -match "could not translate host name") {
    throw "Host resolution failed for $DatabaseHost. Use the Supabase Session Pooler connection details if the direct endpoint does not resolve. Original error: $($_.Exception.Message)"
  }
  if ($_.Exception.Message -match "no pg_hba.conf entry|SSL off") {
    throw "Connection rejected due to SSL/network policy. Ensure the connection includes sslmode=require (mode 2 adds this automatically). Original error: $($_.Exception.Message)"
  }
  throw
}

$RalaOutput = Join-Path (Get-Location) "reports\rala-baseline"
Get-ChildItem $RalaOutput -Filter "*.csv" |
ForEach-Object {
  [PSCustomObject]@{
    File = $_.Name
    Size = $_.Length
    DataRows = @(Import-Csv $_.FullName).Count
  }
} | Format-Table -AutoSize

$ZipPath = Join-Path (Get-Location) "reports\rala-baseline-results.zip"
Compress-Archive -Path (Join-Path $RalaOutput "*.csv") -DestinationPath $ZipPath -Force
Get-Item $ZipPath | Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize
