# TTED-805 Verification Commands

## Authoritative runtime contract

| Scenario | Approved questions | Status |
|---|---:|---|
| `charging-system` | 3 | Available |
| `no-crank` | 0 | Fail-closed |
| IJERT evidence | 0 | Removed because reuse rights were not verified |

Do not populate or approve no-crank questions until replacement evidence passes source-policy, technical, instructional, citation, and human review.

## 1. Verify the public API

```powershell
$ErrorActionPreference = "Stop"

$AppUrl = "https://app.autolearnpro.com"

$ExpectedCounts = @{
    "charging-system" = 3
    "no-crank" = 0
}

$Results = foreach ($Scenario in $ExpectedCounts.Keys) {
    $CacheBuster = (
        [DateTimeOffset]::UtcNow
    ).ToUnixTimeMilliseconds()

    $Uri = (
        "$AppUrl/api/scenario-questions-approved" +
        "?scenario_id=$Scenario" +
        "&cb=$CacheBuster"
    )

    $Response = Invoke-WebRequest `
        -Uri $Uri `
        -Headers @{
            "Cache-Control" = "no-cache"
            "Pragma" = "no-cache"
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

    $AnswerKeyLeaked = (
        $Response.Content -match
        '(?i)"correct_answer"\s*:'
    )

    [PSCustomObject]@{
        Scenario = $Scenario
        StatusCode = [int]$Response.StatusCode
        Expected = $ExpectedCounts[$Scenario]
        Returned = $Questions.Count
        AnswerKeyLeaked = $AnswerKeyLeaked
        Passed = (
            $Response.StatusCode -eq 200 -and
            $Questions.Count -eq
                $ExpectedCounts[$Scenario] -and
            -not $AnswerKeyLeaked
        )
    }
}

$Results |
Format-Table -AutoSize

if (@($Results | Where-Object { -not $_.Passed }).Count) {
    throw "Runtime evidence contract verification failed."
}
```

## 2. Run repository tests

```powershell
$ErrorActionPreference = "Stop"
Set-Location "F:\TorqueMind"

npm test

if ($LASTEXITCODE -ne 0) {
    throw "Jest or Supabase contract tests failed."
}

npx playwright test `
    "tests/playwright/tted805-no-crank-fail-closed.spec.js" `
    "tests/playwright/tted805-no-crank-assessment.spec.js" `
    "tests/playwright/tted805-no-crank-production-readiness.spec.js" `
    "tests/playwright/tted805-verify-grading-integration.spec.js" `
    --project=chromium `
    --reporter=line

if ($LASTEXITCODE -ne 0) {
    throw "TTED-805 Playwright tests failed."
}
```

## 3. Run build and documentation checks

```powershell
npm run docs:mermaid

if ($LASTEXITCODE -ne 0) {
    throw "Mermaid verification failed."
}

npm run build

if ($LASTEXITCODE -ne 0) {
    throw "Build failed."
}
```

## Success criteria

- `charging-system` returns exactly 3 approved questions.
- `no-crank` returns exactly 0 approved questions.
- Neither response exposes `correct_answer`.
- Jest and Supabase contract tests pass.
- Playwright tests pass.
- Mermaid rendering passes.
- The build exits successfully.

An empty no-crank response is expected policy enforcement, not a database failure.
