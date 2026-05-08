# PowerShell wrapper for DB SSL validation
param(
  [switch]$SkipPrompt,
  [switch]$Quiet,
  [switch]$Ci
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$envExample = Join-Path $repoRoot '.env.example'
$envFile = Join-Path $repoRoot '.env'

function Out-Info($m) { if (-not $Quiet) { Write-Host $m } }
function Out-Important($m) { Write-Host $m }

Out-Info "Running DB SSL validator wrapper in: $repoRoot"

# If CI flag provided, force non-interactive quiet mode
if ($Ci) {
  $SkipPrompt = $true
  $Quiet = $true
}

if (-not (Test-Path $envFile)) {
  if (Test-Path $envExample) {
    Copy-Item -Path $envExample -Destination $envFile -Force
    Out-Info "Copied .env.example -> .env. Please edit $envFile and set your Supabase values and PGSSLROOTCERT before full validation."
  } else {
    Write-Warning ".env.example not found; create $envFile manually with your values."
  }
  if (-not $SkipPrompt) {
    if (-not $Quiet) { Read-Host -Prompt "Edit .env now if needed, then press Enter to continue (or Ctrl+C to abort)" }
  }
}

# Load .env into this process environment
function Load-DotEnv($path) {
  if (-not (Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    if ($_ -match '^\s*#') { return }
    if ($_ -match '^\s*$') { return }
    $parts = $_ -split '=', 2
    if ($parts.Count -ne 2) { return }
    $key = $parts[0].Trim()
    $val = $parts[1].Trim().Trim('"')
    if ($key) { [System.Environment]::SetEnvironmentVariable($key, $val) }
  }
}

Load-DotEnv $envFile

$pgssl = [System.Environment]::GetEnvironmentVariable('PGSSLROOTCERT')
$pghost = [System.Environment]::GetEnvironmentVariable('PGHOST')
$pgmode = [System.Environment]::GetEnvironmentVariable('PGSSLMODE')
$pgport = [System.Environment]::GetEnvironmentVariable('PGPORT')

# Ensure defaults so Write-Report can run safely before early exits
$dryExit = 1
$exit = 1

# Helper: write report then exit with code (and record an optional error key/message)
function Write-Report-And-Exit($code, $errKey, $errMsg) {
  if ($errKey) { $errors += $errKey }
  $exit = $code
  try { Write-Report } catch { Write-Warning "Failed to write report: $($_.Exception.Message)" }
  if ($errMsg) { Write-Error $errMsg }
  exit $code
}

# Report helpers
$reportDir = Join-Path $repoRoot 'reports'
$reportFile = Join-Path $reportDir 'db-ssl-validation-report.json'
$errors = @()
$networkReachable = $false
$psqlAvailable = $false

function Write-Report {
  if (-not (Test-Path $reportDir)) { New-Item -Path $reportDir -ItemType Directory | Out-Null }

  # Normalize values to match the JSON schema expectations
  $outSslMode = ''
  if ($pgmode) { $outSslMode = [string]$pgmode }

  if ($errors -is [System.Array]) {
    $outErrors = $errors
  } elseif ($errors) {
    $outErrors = @($errors)
  } else {
    $outErrors = @()
  }

  # Prepare string-valued fields to avoid inline expressions in the hashtable
  $outMode = 'interactive'
  if ($Ci) { $outMode = 'ci' }
  $outDryRun = 'fail'
  if ($dryExit -eq 0) { $outDryRun = 'ok' }
  $outValidation = 'fail'
  if ($exit -eq 0) { $outValidation = 'ok' }

  $report = [PSCustomObject]@{
    timestamp = (Get-Date).ToString('o')
    mode = $outMode
    dryRun = $outDryRun
    validation = $outValidation
    exitCode = $exit
    hostSet = ($pghost -and -not ($pghost -match 'your-project' -or $pghost -match 'db\.your-project'))
    caSet = -not [string]::IsNullOrEmpty($pgssl)
    caExists = ($pgssl -and (Test-Path $pgssl)) -eq $true
    sslMode = $outSslMode
    networkReachable = $networkReachable
    psqlAvailable = $psqlAvailable
    errors = $outErrors
  }

  $json = $report | ConvertTo-Json -Depth 4
  $json | Out-File -FilePath $reportFile -Encoding utf8
}

# In CI mode, fail fast on missing critical environment or CA
$ciFailed = $false
$required = @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE')
$missing = $required | Where-Object { [string]::IsNullOrEmpty([System.Environment]::GetEnvironmentVariable($_)) }
if ($missing.Count -gt 0) {
  Out-Info "Env vars present: $((($required | Where-Object { -not ($missing -contains $_) }) -join ', ') -or '(none)')"
  Write-Warning "Env vars missing: $($missing -join ', ')"
  $errors += "missing_env: $($missing -join ',')"
  if ($Ci) { Write-Report-And-Exit 5 'missing_env' 'CI mode: missing required environment variables, aborting.' }
}

Out-Info "PGHOST: $($pghost -or '(not set)')"
Out-Info "PGSSLMODE: $($pgmode -or '(not set)')"
Out-Important "PGSSLROOTCERT: $($pgssl -or '(not set)')"

if ($pgssl) {
  if (Test-Path $pgssl) {
    Out-Important "CA file exists: $pgssl"
  } else {
    Write-Warning "CA file not found at: $pgssl"
    if ($Ci) {
      Write-Report-And-Exit 2 'ca_missing' 'CI mode: CA file missing, aborting.'
    }
    if (-not $SkipPrompt) {
      if (-not $Quiet) {
        $ans = Read-Host "Continue anyway? (y/N)"
        if ($ans -notin @('y','Y','yes','YES')) { Write-Host 'Aborting at user request.'; exit 2 }
      } else {
        Write-Warning 'CA file not found and running in Quiet mode; aborting.'; exit 2
      }
    }
  }
} else {
  Write-Warning 'PGSSLROOTCERT not set in .env — full verification (verify-full) requires a CA file.'
}

Out-Info "Running dry-run validator (no DB connection)..."
if ($Quiet) {
  & npm run db:validate -- --dry-run > $null 2>&1
} else {
  & npm run db:validate -- --dry-run
}
$dryExit = $LASTEXITCODE
if ($dryExit -ne 0) {
  if ($Quiet) { Write-Host "Dry-run: FAIL (exit $dryExit)" } else { Write-Warning "Dry-run returned exit code $dryExit" }
} else {
  if ($Quiet) { Write-Host "Dry-run: OK" } else { Out-Info "Dry-run completed successfully." }
}

if (-not $SkipPrompt) {
  $proceed = Read-Host "Proceed with full validation (will attempt DB connection)? (y/N)"
  if ($proceed -notin @('y','Y','yes','YES')) { Write-Host 'Skipping full validation.'; exit $dryExit }
}

Out-Info "Running full validator (will attempt DB connection)..."
if ($Quiet) {
  & npm run db:validate > $null 2>&1
} else {
  & npm run db:validate
}
$exit = $LASTEXITCODE
if ($exit -ne 0) {
  if ($Quiet) { Write-Host "Validation: FAIL (exit $exit)" } else { Write-Warning "Validator exited with code $exit"; Write-Host "`nTroubleshooting checklist:`n" }

  if (-not $pghost -or $pghost -match 'your-project' -or $pghost -match 'db\.your-project') {
    Write-Host "- PGHOST appears to be a placeholder or not set. Update 'PGHOST' in .env to your Supabase DB host (e.g. db.<your-project>.supabase.co)."
  }

  if ($pgport) {
    if ($pgport -eq '6543') {
      Write-Host "- Detected port 6543: you may be connecting to Supavisor (pooler). Use pooler host/port and ensure CA is compatible."
    } elseif ($pgport -eq '5432') {
      Write-Host "- Detected port 5432: this is the direct DB port (recommended for direct connections)."
    } else {
      Write-Host "- PGPORT is set to '$pgport'. Confirm whether this is the pooler (6543) or direct DB (5432)."
    }
  } else {
    Write-Host "- PGPORT not set; defaulting to 5432. Confirm the correct port for your connection."
  }

  if ($pgmode -ne 'verify-full' -and $pgmode -ne 'verify-ca') {
    Write-Host "- PGSSLMODE is '$pgmode'. For strongest verification set PGSSLMODE=verify-full."
  } else {
    Write-Host "- PGSSLMODE is set to '$pgmode'. Ensure PGSSLROOTCERT points to the Supabase CA file."
  }

  if ($pgssl) {
    if (Test-Path $pgssl) {
      Write-Host "- PGSSLROOTCERT file exists at $pgssl."
    } else {
      Write-Host "- PGSSLROOTCERT path does not exist. Make sure the file is downloaded from Supabase Database Settings and path is correct."
    }
  }

  Write-Host "- Network: confirm your machine can resolve and reach the host. Try: `nslookup <your-host>` or `Test-NetConnection -ComputerName <host> -Port <port>` in PowerShell."
  # Run Test-NetConnection if host looks real and port is set
  if ($pghost -and -not ($pghost -match 'your-project' -or $pghost -match 'db\.your-project') -and $pgport) {
      if (-not $Quiet) { Write-Host "`n- Running Test-NetConnection $pghost -Port $pgport" }
      try {
        $tnc = Test-NetConnection -ComputerName $pghost -Port ([int]$pgport) -WarningAction SilentlyContinue
        if ($tnc.TcpTestSucceeded) {
          Write-Host "  - TCP connection succeeded (port reachable)."
          $networkReachable = $true
        } else {
          Write-Host "  - TCP connection failed. Test-NetConnection output:"
          Write-Host ($tnc | Out-String)
          $errors += 'network_unreachable'
          if ($Ci) { Write-Report-And-Exit 6 'network_unreachable' 'CI mode: network connectivity to DB host failed.' }
          $ciFailed = $true
        }
      } catch {
        Write-Host "  - Test-NetConnection failed to run: $($_.Exception.Message)"
        $errors += 'test_netconnection_failed'
        if ($Ci) { Write-Report-And-Exit 7 'test_netconnection_failed' 'CI mode: Test-NetConnection failed.' }
        $ciFailed = $true
      }
  }

  # Optional: psql guidance if installed
  $portToUse = if ($pgport) { $pgport } else { '5432' }
  if (Get-Command psql -ErrorAction SilentlyContinue) {
    $psqlAvailable = $true
    Write-Host "- psql found. To test with psql, run (replace YOUR_PASSWORD):"
    $psqlCmd = '  psql "postgresql://postgres:YOUR_PASSWORD@{0}:{1}/postgres?sslmode=verify-full&sslrootcert={2}"' -f $pghost, $portToUse, $pgssl
    Write-Host $psqlCmd
  } else {
    Write-Host "- psql not installed; skipping psql test."
    $psqlAvailable = $false
  }

  Write-Host "- Supabase docs: https://supabase.com/docs/guides/platform/ssl-enforcement"
}
if ($Ci) {
  # Write a machine-readable report for CI upload
  Write-Report
  if ($exit -eq 0 -and -not $ciFailed) {
    Exit 0
  } else {
    Exit 1
  }
} else {
  Write-Report
  exit $exit
}
