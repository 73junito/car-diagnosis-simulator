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

function Test-NonEmptyString {
    param($Value)

    return -not [string]::IsNullOrWhiteSpace([string]$Value)
}

function Test-ChunkIsRetrievable {
    param($Source, $Chunk)

    return (
        ([string]$Source.ingestion_rights_status -eq "unrestricted_ingestion") -and
        (Test-NonEmptyString $Chunk.text_excerpt) -and
        (Test-NonEmptyString $Chunk.text_hash)
    )
}

if (-not $manifest.rights_policy) {
    $errors += "Missing rights_policy block in manifest."
}

$sourceMap = @{}
$chunkMap = @{}

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

    if ([string]$src.source_class -eq "nhtsa_manufacturer_communication") {
        if (-not ($src.storage_path -match 'nhtsa\.gov')) {
            $errors += "NHTSA source '$($src.id)' must preserve a direct NHTSA URL in storage_path."
        }

        if ($null -eq $src.nhtsa_metadata) {
            $errors += "NHTSA source '$($src.id)' missing nhtsa_metadata."
        }
        else {
            if (-not (Test-NonEmptyString $src.nhtsa_metadata.nhtsa_url)) {
                $errors += "NHTSA source '$($src.id)' missing nhtsa_metadata.nhtsa_url."
            }

            if (-not (Test-NonEmptyString $src.nhtsa_metadata.bulletin_number)) {
                $errors += "NHTSA source '$($src.id)' missing nhtsa_metadata.bulletin_number."
            }

            if ([string]$src.nhtsa_metadata.recall_status -eq 'recall' -and -not (Test-NonEmptyString $src.nhtsa_metadata.recall_evidence)) {
                $errors += "NHTSA source '$($src.id)' cannot be labeled as a recall without explicit recall_evidence."
            }
        }
    }

    $sourceMap[$src.id] = $src

    foreach ($chunk in $src.chunks) {
        if ($chunkMap.ContainsKey([string]$chunk.chunk_id)) {
            $errors += "Duplicate chunk_id '$($chunk.chunk_id)' found in manifest."
            continue
        }

        $chunkMap[[string]$chunk.chunk_id] = [PSCustomObject]@{
            Source = $src
            Chunk = $chunk
        }
    }
}

function Test-Citations {
    param(
        [object[]]$QuestionSet,
        [string]$Label,
        [switch]$ValidateRetrievability
    )

    foreach ($q in $QuestionSet) {
        if ($ValidateRetrievability) {
            if ($null -eq $q.human_review) {
                $script:errors += "$Label question '$($q.question_id)' missing human_review block."
            }
            else {
                if (-not (Test-NonEmptyString $q.human_review.reviewer_name)) {
                    $script:errors += "$Label question '$($q.question_id)' missing human_review.reviewer_name."
                }

                if (-not (Test-NonEmptyString $q.human_review.review_date)) {
                    $script:errors += "$Label question '$($q.question_id)' missing human_review.review_date."
                }

                if (-not (Test-NonEmptyString $q.human_review.source_evidence_id)) {
                    $script:errors += "$Label question '$($q.question_id)' missing human_review.source_evidence_id."
                }
            }
        }

        foreach ($c in $q.citations) {
            if (-not $sourceMap.ContainsKey($c.source_id)) {
                $script:errors += "$Label question '$($q.question_id)' cites unknown source_id '$($c.source_id)'."
                continue
            }

            $src = $sourceMap[$c.source_id]
            $hasQuote = $null -ne $c.quote -and -not [string]::IsNullOrWhiteSpace([string]$c.quote)

            if (-not $chunkMap.ContainsKey([string]$c.chunk_id)) {
                $script:errors += "$Label question '$($q.question_id)' cites unknown chunk_id '$($c.chunk_id)' for source '$($c.source_id)'."
                continue
            }

            $chunkRef = $chunkMap[[string]$c.chunk_id]
            $chunkSource = $chunkRef.Source
            $chunk = $chunkRef.Chunk

            if ([string]$chunkSource.id -ne [string]$c.source_id) {
                $script:errors += "$Label question '$($q.question_id)' cites chunk '$($c.chunk_id)' under source '$($c.source_id)', but the chunk belongs to source '$($chunkSource.id)'."
                continue
            }

            if ($src.ingestion_rights_status -ne "unrestricted_ingestion" -and $hasQuote) {
                $script:errors += "$Label question '$($q.question_id)' contains verbatim quote for restricted source '$($c.source_id)'."
            }

            if (-not $c.evidence_summary -or [string]::IsNullOrWhiteSpace([string]$c.evidence_summary)) {
                $script:errors += "$Label question '$($q.question_id)' missing evidence_summary for source '$($c.source_id)'."
            }

            if ($ValidateRetrievability) {
                if (-not (Test-ChunkIsRetrievable -Source $chunkSource -Chunk $chunk)) {
                    $script:errors += "$Label question '$($q.question_id)' cites non-retrievable chunk '$($c.chunk_id)' from source '$($c.source_id)'."
                    continue
                }

                if ([string]$chunkSource.status -ne 'approved') {
                    $script:errors += "$Label question '$($q.question_id)' cites source '$($c.source_id)' with status '$($chunkSource.status)'; retrievable citations require approved sources."
                }

                if ([string]$chunk.status -ne 'approved' -or $chunk.approved -ne $true) {
                    $script:errors += "$Label question '$($q.question_id)' cites chunk '$($c.chunk_id)' that is not approved for retrieval."
                }
            }
        }
    }
}

Test-Citations -QuestionSet $manifest.questions -Label "manifest"
Test-Citations -QuestionSet $batch.questions -Label "batch" -ValidateRetrievability

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
