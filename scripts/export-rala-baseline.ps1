param(
  [Parameter(Mandatory=$true)]
  [string]$DatabaseHost,

  [Parameter(Mandatory=$true)]
  [string]$DatabasePort,

  [Parameter(Mandatory=$true)]
  [string]$DatabaseName,

  [Parameter(Mandatory=$true)]
  [string]$DatabaseUser,

  [Parameter(Mandatory=$true)]
  [Security.SecureString]$DatabasePassword,

  [string]$OutputDir = "reports/rala-baseline"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql is not installed or not in PATH."
}

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

function Test-TableExists([string]$TableName) {
  $Probe = psql -h $DatabaseHost -p $DatabasePort -U $DatabaseUser -d $DatabaseName -At -v ON_ERROR_STOP=1 -c "select case when to_regclass('$TableName') is null then '0' else '1' end;"

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to inspect table existence: $TableName"
  }

  return $Probe.Trim() -eq '1'
}

function Write-DiagnosticCsv {
  param(
    [string]$CsvPath,
    [string]$QuerySql,
    [string[]]$MissingTables
  )

  [PSCustomObject]@{
    status = 'missing_relations'
    query = $QuerySql
    missing_tables = ($MissingTables -join ';')
  } | Export-Csv -Path $CsvPath -NoTypeInformation -Encoding utf8
}

Set-Location (Join-Path $PSScriptRoot "..")

$RalaOutput = Join-Path (Get-Location) $OutputDir
New-Item -ItemType Directory -Path $RalaOutput -Force | Out-Null

$env:PGPASSWORD = ConvertTo-PlainText $DatabasePassword
try {
  $env:PGSSLMODE = "require"
  psql -h $DatabaseHost -p $DatabasePort -U $DatabaseUser -d $DatabaseName -v ON_ERROR_STOP=1 -c "select 1;" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Preflight connection test failed."
  }

  $Queries = @(
    @{ Sql = ".\scripts\rala_a_full_chain.sql";             Csv = "rala_a_full_chain.csv";             Tables = @("public.question_provenance", "public.question_citations", "public.source_chunks", "public.approved_sources") },
    @{ Sql = ".\scripts\rala_b_integrity_distribution.sql"; Csv = "rala_b_integrity_distribution.csv"; Tables = @("public.question_provenance", "public.question_citations", "public.source_chunks", "public.approved_sources") },
    @{ Sql = ".\scripts\rala_c_question_readiness.sql";     Csv = "rala_c_question_readiness.csv";     Tables = @("public.scenario_questions", "public.question_provenance") },
    @{ Sql = ".\scripts\rala_d_missing_provenance.sql";     Csv = "rala_d_missing_provenance.csv";     Tables = @("public.scenario_questions", "public.question_provenance") },
    @{ Sql = ".\scripts\rala_e_unapproved_sources.sql";     Csv = "rala_e_unapproved_sources.csv";     Tables = @("public.question_citations", "public.approved_sources") }
  )

  foreach ($Query in $Queries) {
    $CsvPath = Join-Path $RalaOutput $Query.Csv

    $MissingTables = @()
    foreach ($TableName in $Query.Tables) {
      if (-not (Test-TableExists $TableName)) {
        $MissingTables += $TableName
      }
    }

    if ($MissingTables.Count -gt 0) {
      Write-Warning "Skipping $($Query.Sql) because the database is missing: $($MissingTables -join ', ')"
      Write-DiagnosticCsv -CsvPath $CsvPath -QuerySql $Query.Sql -MissingTables $MissingTables
      Write-Host "Created diagnostic CSV: $CsvPath"
      continue
    }

    psql -h $DatabaseHost -p $DatabasePort -U $DatabaseUser -d $DatabaseName -v ON_ERROR_STOP=1 --csv -f $Query.Sql | Set-Content -Path $CsvPath -Encoding utf8

    if ($LASTEXITCODE -ne 0) {
      throw "Query failed: $($Query.Sql)"
    }

    Write-Host "Created: $CsvPath"
  }
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
}

Get-ChildItem $RalaOutput -File | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
