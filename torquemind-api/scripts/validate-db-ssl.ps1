# PowerShell wrapper for DB SSL validation
param(
  [switch]$SkipPrompt
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$envExample = Join-Path $repoRoot '.env.example'
$envFile = Join-Path $repoRoot '.env'

Write-Host "Running DB SSL validator wrapper in: $repoRoot"

if (-not (Test-Path $envFile)) {
  if (Test-Path $envExample) {
    Copy-Item -Path $envExample -Destination $envFile -Force
    Write-Host "Copied .env.example -> .env. Please edit $envFile and set your Supabase values and PGSSLROOTCERT before full validation."
  } else {
    Write-Warning ".env.example not found; create $envFile manually with your values."
  }
  if (-not $SkipPrompt) {
    Read-Host -Prompt "Edit .env now if needed, then press Enter to continue (or Ctrl+C to abort)"
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

Write-Host "PGHOST: $($pghost -or '(not set)')"
Write-Host "PGSSLMODE: $($pgmode -or '(not set)')"
Write-Host "PGSSLROOTCERT: $($pgssl -or '(not set)')"

if ($pgssl) {
  if (Test-Path $pgssl) {
    Write-Host "CA file exists: $pgssl"
  } else {
    Write-Warning "CA file not found at: $pgssl"
    if (-not $SkipPrompt) {
      $ans = Read-Host "Continue anyway? (y/N)"
      if ($ans -notin @('y','Y','yes','YES')) { Write-Host 'Aborting at user request.'; exit 2 }
    }
  }
} else {
  Write-Warning 'PGSSLROOTCERT not set in .env — full verification (verify-full) requires a CA file.'
}

Write-Host "Running dry-run validator (no DB connection)..."
& npm run db:validate -- --dry-run
$dryExit = $LASTEXITCODE
if ($dryExit -ne 0) {
  Write-Warning "Dry-run returned exit code $dryExit"
}

if (-not $SkipPrompt) {
  $proceed = Read-Host "Proceed with full validation (will attempt DB connection)? (y/N)"
  if ($proceed -notin @('y','Y','yes','YES')) { Write-Host 'Skipping full validation.'; exit $dryExit }
}

Write-Host "Running full validator (will attempt DB connection)..."
& npm run db:validate
$exit = $LASTEXITCODE
if ($exit -ne 0) {
  Write-Warning "Validator exited with code $exit"
  Write-Host "`nTroubleshooting checklist:`n"

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
    Write-Host "`n- Running Test-NetConnection $pghost -Port $pgport"
    try {
      $tnc = Test-NetConnection -ComputerName $pghost -Port ([int]$pgport) -WarningAction SilentlyContinue
      if ($tnc.TcpTestSucceeded) {
        Write-Host "  - TCP connection succeeded (port reachable)."
      } else {
        Write-Host "  - TCP connection failed. Test-NetConnection output:"
        Write-Host ($tnc | Out-String)
      }
    } catch {
      Write-Host "  - Test-NetConnection failed to run: $($_.Exception.Message)"
    }
  }

  # Optional: psql guidance if installed
  if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Host "- psql found. To test with psql, run (replace YOUR_PASSWORD):"
    Write-Host "  psql \"postgresql://postgres:YOUR_PASSWORD@$pghost:$($pgport -or '5432')/postgres?sslmode=verify-full&sslrootcert=$pgssl\""
  } else {
    Write-Host "- psql not installed; skipping psql test."
  }

  Write-Host "- Supabase docs: https://supabase.com/docs/guides/platform/ssl-enforcement"
}
exit $exit
