param(
    [string]$ManifestPath = ".\data\rala\approved-source-manifest.json",
    [string]$BatchPath = ".\reports\rala-pilot-batch.json"
)

$ErrorActionPreference = "Stop"

$allowedStatuses = @(
    "unrestricted_ingestion",
    "metadata_and_link_only",
    "limited_quote_review_required",
    "permission_required",
    "prohibited",
    "unknown_blocked"
)

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$batch = Get-Content $BatchPath -Raw | ConvertFrom-Json

$errors = @()

if (-not $manifest.rights_policy) {
    $errors += "Missing rights_policy block in manifest."
}

foreach ($src in $manifest.sources) {
    if (-not $src.ingestion_rights_status) {
        $errors += "Source '$($src.id)' missing ingestion_rights_status."
        continue
    }

    if ($allowedStatuses -notcontains $src.ingestion_rights_status) {
        $errors += "Source '$($src.id)' has invalid ingestion_rights_status '$($src.ingestion_rights_status)'."
    }

    if (-not $src.training_use_status) {
        $errors += "Source '$($src.id)' missing training_use_status."
    }

    if (-not $src.rights_reviewed_by) {
        $errors += "Source '$($src.id)' missing rights_reviewed_by."
    }

    if ($src.ingestion_rights_status -eq "unrestricted_ingestion") {
        $hasReviewer = -not [string]::IsNullOrWhiteSpace([string]$src.rights_reviewed_by) -and ([string]$src.rights_reviewed_by -ne "pending")
        $hasReviewDate = $null -ne $src.rights_review_date -and -not [string]::IsNullOrWhiteSpace([string]$src.rights_review_date)
        $trainingAuthorized = ([string]$src.training_use_status -eq "authorized")
        $redistributionAuthorized = ([string]$src.redistribution_status -eq "authorized")

        if (-not ($hasReviewer -and $hasReviewDate -and $trainingAuthorized -and $redistributionAuthorized)) {
            $errors += "Source '$($src.id)' cannot be unrestricted_ingestion without documented approval (reviewer/date and authorized training/redistribution)."
        }
    }

    # Fail closed: restricted sources must not store verbatim or excerpt text.
    if ($src.ingestion_rights_status -ne "unrestricted_ingestion") {
        foreach ($chunk in $src.chunks) {
            if ($null -ne $chunk.text_excerpt -and -not [string]::IsNullOrWhiteSpace([string]$chunk.text_excerpt)) {
                $errors += "Source '$($src.id)' chunk '$($chunk.chunk_id)' contains text_excerpt under restricted ingestion status '$($src.ingestion_rights_status)'."
            }
        }
    }
}

$sourceMap = @{}
foreach ($src in $manifest.sources) {
    $sourceMap[$src.id] = $src
}

function Test-Citations {
    param(
        [object[]]$QuestionSet,
        [string]$Label
    )

    foreach ($q in $QuestionSet) {
        foreach ($c in $q.citations) {
            if (-not $sourceMap.ContainsKey($c.source_id)) {
                $script:errors += "$Label question '$($q.question_id)' cites unknown source_id '$($c.source_id)'."
                continue
            }

            $src = $sourceMap[$c.source_id]
            $hasQuote = $null -ne $c.quote -and -not [string]::IsNullOrWhiteSpace([string]$c.quote)

            if ($src.ingestion_rights_status -ne "unrestricted_ingestion" -and $hasQuote) {
                $script:errors += "$Label question '$($q.question_id)' contains verbatim quote for restricted source '$($c.source_id)'."
            }

            if (-not $c.evidence_summary -or [string]::IsNullOrWhiteSpace([string]$c.evidence_summary)) {
                $script:errors += "$Label question '$($q.question_id)' missing evidence_summary for source '$($c.source_id)'."
            }
        }
    }
}

Test-Citations -QuestionSet $manifest.questions -Label "manifest"
Test-Citations -QuestionSet $batch.questions -Label "batch"

# Contradictory markers must not appear while rights are pending.
foreach ($q in $batch.questions) {
    if ($q.validation_checklist -and $q.validation_checklist.license_ok -eq $true) {
        $errors += "batch question '$($q.question_id)' has contradictory license_ok=true while rights review is pending."
    }
}

if ($batch.rights_review_state -eq "approved") {
    $errors += "batch rights_review_state is 'approved' unexpectedly."
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    throw "RALA rights validation failed with $($errors.Count) issue(s)."
}

Write-Output "RALA_RIGHTS_VALIDATION_PASS (policy checks passed; this is not legal clearance)"
