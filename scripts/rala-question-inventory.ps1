param(
  [string]$DatabaseHost = "aws-1-us-west-2.pooler.supabase.com",
  [int]$DatabasePort = 5432,
  [string]$DatabaseName = "postgres",
  [string]$DatabaseUser = "postgres.pffdgqpynpbffbcnxmum",
  [string]$OutputPath = "reports/rala-question-inventory.txt"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql is not installed or not in PATH."
}

function Invoke-PsqlQuery {
  param(
    [string]$Sql,
    [string]$OutputFile
  )

  psql `
    -h $DatabaseHost `
    -p $DatabasePort `
    -U $DatabaseUser `
    -d $DatabaseName `
    -v ON_ERROR_STOP=1 `
    -P pager=off `
    -c $Sql |
    Out-File -FilePath $OutputFile -Encoding utf8

  if ($LASTEXITCODE -ne 0) {
    throw "psql query failed."
  }
}

$Credential = Get-Credential `
  -UserName $DatabaseUser `
  -Message "Enter the Supabase database password"

$env:PGPASSWORD = $Credential.GetNetworkCredential().Password
$env:PGSSLMODE = "require"

try {
  $SchemaProbe = @"
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'scenario_questions'
order by ordinal_position;
"@

  $Columns = @(psql -h $DatabaseHost -p $DatabasePort -U $DatabaseUser -d $DatabaseName -At -v ON_ERROR_STOP=1 -P pager=off -c $SchemaProbe)
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to inspect scenario_questions schema."
  }

  $HasCorrectAnswer = $Columns -contains 'correct_answer'

  if ($HasCorrectAnswer) {
    $InventorySql = @"
select
  sq.id as scenario_question_uuid,
  sq.question_id,
  sq.scenario_id,
  sq.topic,
  sq.ase_area,
  coalesce(qp.status, 'missing') as provenance_status,
  sq.question_text,
  sq.correct_answer
from public.scenario_questions sq
left join public.question_provenance qp
  on qp.question_id = sq.question_id
order by sq.scenario_id, sq.topic, provenance_status, sq.question_id;
"@
  } else {
    $InventorySql = @"
select
  sq.id as scenario_question_uuid,
  sq.question_id,
  sq.scenario_id,
  sq.topic,
  sq.ase_area,
  coalesce(qp.status, 'missing') as provenance_status,
  sq.question_text,
  null::text as correct_answer
from public.scenario_questions sq
left join public.question_provenance qp
  on qp.question_id = sq.question_id
order by sq.scenario_id, sq.topic, provenance_status, sq.question_id;
"@
  }

  $InventoryDir = Split-Path -Parent $OutputPath
  if ($InventoryDir) {
    New-Item -ItemType Directory -Path $InventoryDir -Force | Out-Null
  }

  $CsvPath = [System.IO.Path]::ChangeExtension($OutputPath, '.csv')

  Invoke-PsqlQuery -Sql "$InventorySql" -OutputFile $OutputPath
  psql `
    -h $DatabaseHost `
    -p $DatabasePort `
    -U $DatabaseUser `
    -d $DatabaseName `
    -v ON_ERROR_STOP=1 `
    -P pager=off `
    --csv `
    -c $InventorySql |
    Out-File -FilePath $CsvPath -Encoding utf8

  if ($LASTEXITCODE -ne 0) {
    throw "CSV inventory export failed."
  }

  $RowCount = (Get-Content $CsvPath | Measure-Object -Line).Lines - 1
  Write-Host "Created inventory report: $OutputPath"
  Write-Host "Created inventory CSV:    $CsvPath"
  Write-Host "Inventory rows:           $RowCount"
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
  Remove-Variable Credential -ErrorAction SilentlyContinue
}
