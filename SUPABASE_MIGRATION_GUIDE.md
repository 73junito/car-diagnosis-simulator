# Supabase Migration and Evidence Verification Guide

## Current state

The Supabase migrations merged through PR #387 have already been replayed successfully in Supabase Preview.

Verified Preview state:

- Project status: `ACTIVE_HEALTHY`
- Deployment stage: `FUNCTIONS_DEPLOYED`
- Expected migration versions: 28
- Safe seed: completed
- Manual SQL Editor deployment: not required

The `citation_validations` table exists through the tracked migration chain. Do not recreate it manually and do not add public read policies outside a reviewed security migration.

## Migration source of truth

Migration files under `supabase/migrations/` are authoritative.

Do not:

- paste replacement schemas into the production SQL Editor;
- mark migrations applied without executing their reviewed SQL;
- rewrite production migration history;
- reset or rebase a Supabase branch solely to clear an error;
- grant `anon` or `authenticated` direct access to answer-bearing tables;
- populate no-crank validations without policy-approved evidence.

## Verify linked-project identity

```powershell
$ErrorActionPreference = "Stop"
Set-Location "F:\TorqueMind"

$ExpectedProductionProject = "pffdgqpynpbffbcnxmum"

$LinkedProjectFile = "supabase\.temp\project-ref"

if (-not (Test-Path -LiteralPath $LinkedProjectFile)) {
    throw "Supabase linked-project file is missing."
}

$LinkedProject = (
    Get-Content `
        -LiteralPath $LinkedProjectFile `
        -Raw
).Trim()

if ($LinkedProject -ne $ExpectedProductionProject) {
    throw (
        "Stop: linked project is $LinkedProject; " +
        "expected $ExpectedProductionProject."
    )
}
```

## Read-only migration inventory

```
npx supabase migration list `
    --linked

if ($LASTEXITCODE -ne 0) {
    throw "Could not retrieve linked migration history."
}
```

Compare remote versions with tracked files:

```powershell
$TrackedVersions = @(
    git ls-files `
        "supabase/migrations/*.sql" |
    ForEach-Object {
        (
            [System.IO.Path]::GetFileName($_) `
                -split "_"
        )[0]
    } |
    Sort-Object -Unique
)

[PSCustomObject]@{
    TrackedMigrationCount = $TrackedVersions.Count
    FirstVersion = $TrackedVersions[0]
    LastVersion = $TrackedVersions[-1]
} |
Format-List
```

## Schema verification

Use read-only SQL through an approved administrative channel:

```sql
select
    to_regclass(
        'public.citation_validations'
    ) as citation_validations_table;

select
    version,
    name
from supabase_migrations.schema_migrations
order by version;
```

Expected:

- `public.citation_validations` exists.
- All expected migration versions appear.
- No migration-history mismatch is reported.

## Runtime evidence contract

| Scenario | Approved questions |
|---|---:|
| `charging-system` | 3 |
| `no-crank` | 0 |

The no-crank result is intentionally empty. Do not run the citation validator in write mode for no-crank until new evidence is approved.

## Public API verification

```powershell
$ErrorActionPreference = "Stop"

$AppUrl = "https://app.autolearnpro.com"

$ExpectedCounts = @{
    "charging-system" = 3
    "no-crank" = 0
}

foreach ($Scenario in $ExpectedCounts.Keys) {
    $Uri = (
        "$AppUrl/api/" +
        "scenario-questions-approved" +
        "?scenario_id=$Scenario" +
        "&cb=" +
        [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    )

    $Response = Invoke-WebRequest `
        -Uri $Uri `
        -Headers @{
            "Cache-Control" = "no-cache"
        } `
        -SkipHttpErrorCheck

    $Payload = $Response.Content |
        ConvertFrom-Json

    $Questions = if ($null -ne $Payload.questions) {
        @($Payload.questions)
    }
    elseif ($null -ne $Payload.approved_questions) {
        @($Payload.approved_questions)
    }
    else {
        @()
    }

    if ($Response.StatusCode -ne 200) {
        throw "$Scenario returned HTTP $($Response.StatusCode)."
    }

    if ($Questions.Count -ne $ExpectedCounts[$Scenario]) {
        throw (
            "$Scenario returned $($Questions.Count); " +
            "expected $($ExpectedCounts[$Scenario])."
        )
    }

    if (
        $Response.Content -match
        '(?i)"correct_answer"\s*:'
    ) {
        throw "$Scenario leaked an answer key."
    }
}
```

## Future no-crank evidence workflow

Before any database population:

1. Verify the source license or explicit written reuse permission.
2. Record the source in draft status.
3. Create minimal evidence chunks within the permitted license scope.
4. Verify artifact and excerpt hashes.
5. Generate questions using only the approved chunks.
6. Complete technical and instructional human review.
7. Validate answer and explanation citations.
8. Simulate all database changes inside a rollback transaction.
9. Obtain explicit approval.
10. Apply a reviewed migration or controlled ingestion transaction.
11. Verify the public API and answer-key security.

Unverified sources must remain fail-closed and must not be converted into approved instructional evidence.

## Security boundary

- Service-role credentials must never be committed.
- Do not place service-role credentials directly in command history.
- `citation_validations` and answer-bearing records remain server-side.
- Client applications must use public API routes that remove answer keys.
- Ownership-based RLS remains deferred to a dedicated security PR.
