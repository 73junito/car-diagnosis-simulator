param(
  [string]$InventoryCsvPath = "reports/rala-question-inventory.csv",
  [string]$ManifestPath = "data/rala/approved-source-manifest.template.json",
  [string]$PilotBatchPath = "reports/rala-pilot-batch.json",
  [string]$OutputSqlPath = "reports/rala-pilot-ingestion.sql",
  [switch]$Apply,
  [string]$DatabaseHost = "aws-1-us-west-2.pooler.supabase.com",
  [int]$DatabasePort = 5432,
  [string]$DatabaseName = "postgres",
  [string]$DatabaseUser = "postgres.pffdgqpynpbffbcnxmum"
)

$ErrorActionPreference = "Stop"

function Escape-SqlLiteral {
  param([AllowNull()][string]$Value)

  if ($null -eq $Value) { return 'null' }
  return "'" + ($Value -replace "'", "''") + "'"
}

function ConvertTo-JsonSql {
  param([AllowNull()]$Value)

  if ($null -eq $Value) { return "'{}'::jsonb" }
  $json = $Value | ConvertTo-Json -Depth 20 -Compress
  return Escape-SqlLiteral $json + '::jsonb'
}

function New-DeterministicUuid {
  param([string]$Seed)

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Seed)
    $hash = $sha.ComputeHash($bytes)
    $hex = -join ($hash | ForEach-Object { $_.ToString('x2') })
    return '{0}-{1}-{2}-{3}-{4}' -f $hex.Substring(0, 8), $hex.Substring(8, 4), $hex.Substring(12, 4), $hex.Substring(16, 4), $hex.Substring(20, 12)
  } finally {
    $sha.Dispose()
  }
}

function Assert-FileExists {
  param([string]$PathValue)
  if (-not (Test-Path $PathValue)) {
    throw "Missing required file: $PathValue"
  }
}

function Test-RestrictedChunkOmissionAllowed {
  param($Source, $Chunk)

  $isBlankExcerpt = [string]::IsNullOrWhiteSpace([string]$Chunk.text_excerpt)
  if (-not $isBlankExcerpt) { return $false }

  $rightsStatus = [string]$Source.ingestion_rights_status
  $rightsBasis = [string]$Source.rights_basis
  $chunkSummary = [string]$Chunk.chunk_summary

  if ($rightsStatus -notin @('metadata_and_link_only', 'limited_quote_review_required', 'permission_required', 'prohibited', 'unknown_blocked')) {
    return $false
  }

  if ($rightsBasis -notmatch 'metadata|link|blocked|pending_review|pending review') {
    return $false
  }

  if ([string]::IsNullOrWhiteSpace($chunkSummary)) {
    throw "Chunk in source $($Source.id) cannot omit text_excerpt without a chunk_summary describing the non-retrievable evidence."
  }

  return $true
}

Assert-FileExists $InventoryCsvPath
Assert-FileExists $ManifestPath
Assert-FileExists $PilotBatchPath

$Inventory = Import-Csv $InventoryCsvPath
$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Batch = Get-Content $PilotBatchPath -Raw | ConvertFrom-Json

if ($Batch.questions.Count -ne 5) {
  throw "Pilot batch must contain exactly 5 questions."
}

$InventoryById = @{}
foreach ($Row in $Inventory) {
  $InventoryById[$Row.id] = $Row
}

$RetrievableChunkIds = New-Object 'System.Collections.Generic.HashSet[string]'
$OmittedChunkIds = @{}

foreach ($PilotQuestion in $Batch.questions) {
  if (-not $InventoryById.ContainsKey($PilotQuestion.question_id)) {
    throw "Pilot question not found in inventory: $($PilotQuestion.question_id)"
  }
}

if (-not $Manifest.sources -or $Manifest.sources.Count -lt 1) {
  throw "Approved-source manifest must include at least one source before ingestion."
}

foreach ($Source in $Manifest.sources) {
  foreach ($RequiredField in 'id','title','publisher','license','storage_path','checksum','checksum_algorithm','language','version') {
    if ([string]::IsNullOrWhiteSpace([string]$Source.$RequiredField)) {
      throw "Approved-source manifest entry is missing $RequiredField."
    }
  }
  if (-not $Source.chunks -or $Source.chunks.Count -lt 1) {
    throw "Approved-source manifest entry $($Source.id) must define chunks."
  }
}

$Sql = New-Object System.Collections.Generic.List[string]
$Sql.Add('begin;')
$Sql.Add('-- Approved sources')

foreach ($Source in $Manifest.sources) {
  $Sql.Add(@"
insert into public.approved_sources (
  id, title, authors, publisher, publication_year, license, original_filename, storage_path,
  checksum, checksum_algorithm, language, version, status, notes
)
values (
  $(Escape-SqlLiteral $Source.id),
  $(Escape-SqlLiteral $Source.title),
  $(ConvertTo-JsonSql $Source.authors),
  $(Escape-SqlLiteral $Source.publisher),
  $(if ($null -ne $Source.publication_year) { [string]$Source.publication_year } else { 'null' }),
  $(ConvertTo-JsonSql $Source.license),
  $(Escape-SqlLiteral $Source.original_filename),
  $(Escape-SqlLiteral $Source.storage_path),
  $(Escape-SqlLiteral $Source.checksum),
  $(Escape-SqlLiteral $Source.checksum_algorithm),
  $(Escape-SqlLiteral $Source.language),
  $(if ($null -ne $Source.version) { [string]$Source.version } else { '1' }),
  'draft',
  $(Escape-SqlLiteral $Source.notes)
)
on conflict (id) do update set
  title = excluded.title,
  authors = excluded.authors,
  publisher = excluded.publisher,
  publication_year = excluded.publication_year,
  license = excluded.license,
  original_filename = excluded.original_filename,
  storage_path = excluded.storage_path,
  checksum = excluded.checksum,
  checksum_algorithm = excluded.checksum_algorithm,
  language = excluded.language,
  version = excluded.version,
  notes = excluded.notes;
"@.Trim())

  foreach ($Chunk in $Source.chunks) {
    foreach ($RequiredField in 'chunk_id','token_count') {
      if ([string]::IsNullOrWhiteSpace([string]$Chunk.$RequiredField)) {
        throw "Chunk in source $($Source.id) is missing $RequiredField."
      }
    }

    if (Test-RestrictedChunkOmissionAllowed -Source $Source -Chunk $Chunk) {
      $OmittedChunkIds[[string]$Chunk.chunk_id] = [string]$Source.id
      $Sql.Add("-- Omitted non-retrievable chunk insert for source_id=$($Source.id), chunk_id=$($Chunk.chunk_id) because rights metadata restricts ingestion to metadata/link-only evidence.")
      continue
    }

    if ([string]::IsNullOrWhiteSpace([string]$Chunk.text_excerpt)) {
      throw "Chunk in source $($Source.id) is missing text_excerpt."
    }

    if ([string]::IsNullOrWhiteSpace([string]$Chunk.text_hash)) {
      throw "Chunk in source $($Source.id) is missing text_hash."
    }

    [void]$RetrievableChunkIds.Add([string]$Chunk.chunk_id)

    $Sql.Add(@"
insert into public.source_chunks (
  chunk_id, source_id, source_version, title, section, page_start, page_end, locator,
  text_excerpt, token_count, overlap_before_tokens, overlap_after_tokens, text_hash,
  language, status, approved
)
values (
  $(Escape-SqlLiteral $Chunk.chunk_id),
  $(Escape-SqlLiteral $Source.id),
  $(if ($null -ne $Chunk.source_version) { [string]$Chunk.source_version } else { '1' }),
  $(Escape-SqlLiteral $Chunk.title),
  $(Escape-SqlLiteral $Chunk.section),
  $(if ($null -ne $Chunk.page_start) { [string]$Chunk.page_start } else { 'null' }),
  $(if ($null -ne $Chunk.page_end) { [string]$Chunk.page_end } else { 'null' }),
  $(Escape-SqlLiteral $Chunk.locator),
  $(Escape-SqlLiteral $Chunk.text_excerpt),
  $(if ($null -ne $Chunk.token_count) { [string]$Chunk.token_count } else { '0' }),
  $(if ($null -ne $Chunk.overlap_before_tokens) { [string]$Chunk.overlap_before_tokens } else { '0' }),
  $(if ($null -ne $Chunk.overlap_after_tokens) { [string]$Chunk.overlap_after_tokens } else { '0' }),
  $(Escape-SqlLiteral $Chunk.text_hash),
  $(Escape-SqlLiteral $Chunk.language),
  'draft',
  false
)
on conflict (chunk_id) do update set
  source_id = excluded.source_id,
  source_version = excluded.source_version,
  title = excluded.title,
  section = excluded.section,
  page_start = excluded.page_start,
  page_end = excluded.page_end,
  locator = excluded.locator,
  text_excerpt = excluded.text_excerpt,
  token_count = excluded.token_count,
  overlap_before_tokens = excluded.overlap_before_tokens,
  overlap_after_tokens = excluded.overlap_after_tokens,
  text_hash = excluded.text_hash,
  language = excluded.language;
"@.Trim())
  }
}

$Sql.Add('-- Pilot provenance mappings')

foreach ($PilotQuestion in $Batch.questions) {
  $questionId = [string]$PilotQuestion.question_id
  $provenanceId = New-DeterministicUuid -Seed "qp:$questionId"
  $questionRow = $InventoryById[$questionId]

  $Sql.Add(@"
insert into public.question_provenance (
  id, question_id, provenance_version, status, validation_checklist, notes
)
values (
  '$provenanceId',
  $(Escape-SqlLiteral $questionId),
  $(if ($null -ne $PilotQuestion.provenance_version) { [string]$PilotQuestion.provenance_version } else { '1' }),
  'validated',
  $(ConvertTo-JsonSql $PilotQuestion.validation_checklist),
  $(Escape-SqlLiteral "Pilot batch question for scenario $($questionRow.scenario_id), topic $($questionRow.topic)")
)
on conflict (question_id, provenance_version) do update set
  status = excluded.status,
  validation_checklist = excluded.validation_checklist,
  notes = excluded.notes;
"@.Trim())

  foreach ($Citation in $PilotQuestion.citations) {
    if ([string]::IsNullOrWhiteSpace($Citation.source_id) -or [string]::IsNullOrWhiteSpace($Citation.chunk_id)) {
      throw "Pilot question $questionId is missing citation source_id or chunk_id."
    }

    if ($OmittedChunkIds.ContainsKey([string]$Citation.chunk_id)) {
      throw "Pilot question $questionId cites non-retrievable chunk $($Citation.chunk_id) from source $($Citation.source_id). Metadata/link-only chunks must not be ingested as retrievable citations."
    }

    if (-not $RetrievableChunkIds.Contains([string]$Citation.chunk_id)) {
      throw "Pilot question $questionId cites chunk $($Citation.chunk_id) that was not generated as a retrievable source chunk."
    }

    $CitationId = New-DeterministicUuid -Seed "qc:${questionId}:$($Citation.source_id):$($Citation.chunk_id):$($Citation.role)"
    $Sql.Add(@"
insert into public.question_citations (
  id, question_provenance_id, source_id, chunk_id, locator, quote, role
)
values (
  '$CitationId',
  '$provenanceId',
  $(Escape-SqlLiteral $Citation.source_id),
  $(Escape-SqlLiteral $Citation.chunk_id),
  $(Escape-SqlLiteral $Citation.locator),
  $(Escape-SqlLiteral $Citation.quote),
  $(Escape-SqlLiteral $Citation.role)
)
on conflict (id) do nothing;
"@.Trim())
  }
}

$Sql.Add('commit;')

$OutputDir = Split-Path -Parent $OutputSqlPath
if ($OutputDir) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$SqlText = $Sql -join [Environment]::NewLine
Set-Content -Path $OutputSqlPath -Value $SqlText -Encoding utf8
Write-Host "Wrote pilot ingestion SQL: $OutputSqlPath"

if ($Apply) {
  $Credential = Get-Credential `
    -UserName $DatabaseUser `
    -Message "Enter the Supabase database password"

  $env:PGPASSWORD = $Credential.GetNetworkCredential().Password
  $env:PGSSLMODE = "require"

  try {
    psql `
      -h $DatabaseHost `
      -p $DatabasePort `
      -U $DatabaseUser `
      -d $DatabaseName `
      -v ON_ERROR_STOP=1 `
      -f $OutputSqlPath

    if ($LASTEXITCODE -ne 0) {
      throw "Pilot ingestion failed."
    }
  }
  finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
    Remove-Variable Credential -ErrorAction SilentlyContinue
  }
}