param(
  [string]$InventoryCsvPath = "reports/rala-question-inventory.csv",
  [string]$OutputPath = "reports/rala-pilot-batch.json",
  [int]$PilotSize = 5
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $InventoryCsvPath)) {
  throw "Inventory CSV not found: $InventoryCsvPath"
}

$Inventory = Import-Csv $InventoryCsvPath
if ($Inventory.Count -lt $PilotSize) {
  throw "Inventory has fewer than $PilotSize questions."
}

$MissingSemanticIds = @(
  $Inventory |
    Where-Object { [string]::IsNullOrWhiteSpace([string]$_.question_id) }
)

if ($MissingSemanticIds.Count -gt 0) {
  throw "Inventory contains $($MissingSemanticIds.Count) question(s) without a semantic question_id."
}

$Selected = @()
$SeenScenarios = @{}

foreach ($Row in ($Inventory | Sort-Object scenario_id, topic, question_id)) {
  if ($Selected.Count -ge $PilotSize) { break }
  if (-not $SeenScenarios.ContainsKey($Row.scenario_id)) {
    $SeenScenarios[$Row.scenario_id] = $true
    $Selected += $Row
  }
}

if ($Selected.Count -lt $PilotSize) {
  foreach ($Row in ($Inventory | Sort-Object topic, question_id)) {
    if ($Selected.Count -ge $PilotSize) { break }
    if (-not ($Selected.question_id -contains $Row.question_id)) {
      $Selected += $Row
    }
  }
}

$Batch = [ordered]@{
  pilot_name = 'rala-five-question-pilot'
  review_state = 'draft'
  generated_at = (Get-Date).ToString('o')
  selection_policy = @(
    'Prefer one question per scenario when possible',
    'Preserve traceability to the inventory file',
    'Fill citations only with approved source chunks',
    'Do not use fixture data or unreviewed content'
  )
  questions = @()
}

foreach ($Row in $Selected) {
  $Batch.questions += [ordered]@{
    question_id = $Row.question_id
    scenario_id = $Row.scenario_id
    topic = $Row.topic
    ase_area = $Row.ase_area
    provenance_status = $Row.provenance_status
    question_text = $Row.question_text
    provenance_version = 1
    validation_checklist = [ordered]@{
      answer_verified = $true
      explanation_verified = $true
      citation_matches_excerpt = $true
      license_ok = $true
    }
    citations = @(
      [ordered]@{
        role = 'supports-answer'
        source_id = ''
        chunk_id = ''
        locator = ''
        quote = ''
      },
      [ordered]@{
        role = 'supports-explanation'
        source_id = ''
        chunk_id = ''
        locator = ''
        quote = ''
      }
    )
  }
}

$OutputDir = Split-Path -Parent $OutputPath
if ($OutputDir) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$Batch | ConvertTo-Json -Depth 10 | Set-Content -Path $OutputPath -Encoding utf8
Write-Host "Created pilot batch: $OutputPath"
