param([switch]$Deploy)

# Build, deploy, and end-to-end test script for staging
# Run from repository root as Administrator (if needed)

# Confirm the deployment contract before building or deploying.
$ConfigPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'wrangler.app.jsonc'
if (-not (Test-Path $ConfigPath)) { throw 'Missing wrangler.app.jsonc' }
$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
if ($Config.name -ne 'autolearnpro-app' -or $Config.env.staging.name -ne 'autolearnpro-app-staging') {
    throw 'Unexpected staging target; deployment aborted.'
}
if (-not $Deploy) {
    Write-Host 'DRY RUN: staging configuration verified. Pass -Deploy to build, deploy and execute the live smoke request.'
    return
}
# 1. Build
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. Aborting."
    exit 1
}

# 2. Deploy to staging
npx wrangler deploy --config wrangler.app.jsonc --env staging
if ($LASTEXITCODE -ne 0) {
    Write-Error "Staging deployment failed. Aborting."
    exit 1
}

# 3. Restore version.json (avoid committing build artifacts)
# Generated build artifacts must be reviewed separately; do not modify tracked files automatically.

# 4. Start tailing logs in a separate window manually (recommended):
Write-Host "Run in a separate terminal: npx wrangler tail autolearnpro-app-staging --config wrangler.app.jsonc --env staging --format pretty" -ForegroundColor Yellow

# 5. Run the Worker end-to-end test
$StagingUrl = Read-Host "Enter staging base URL (e.g. https://autolearnpro-app-staging.73junito.workers.dev)"

$Body = @{
    scenario      = "Engine cranks but will not start."
    question      = "What should be checked first?"
    studentAnswer = "Replace the starter."
    correctAnswer = "Verify fuel delivery and ignition spark."
    topic         = "Engine Performance"
} | ConvertTo-Json -Compress

try {
    $Response = Invoke-WebRequest `
        -Uri "$StagingUrl/api/torquemind-feedback" `
        -Method POST `
        -ContentType "application/json" `
        -Body $Body `
        -ErrorAction Stop

    $StatusCode = [int]$Response.StatusCode
    $Headers = $Response.Headers
    $ResponseBody = $Response.Content
}
catch {
    $WebResponse = $_.Exception.Response

    if ($null -eq $WebResponse) {
        Write-Error "Request failed and no response captured. Exception: $($_.Exception.Message)"
        exit 1
    }

    $StatusCode = [int]$WebResponse.StatusCode
    $Headers = $WebResponse.Headers

    $Reader = New-Object System.IO.StreamReader(
        $WebResponse.GetResponseStream()
    )

    try {
        $ResponseBody = $Reader.ReadToEnd()
    }
    finally {
        $Reader.Dispose()
    }
}

[PSCustomObject]@{
    Status     = $StatusCode
    RequestId  = $Headers["x-request-id"]
    Limit      = $Headers["x-ratelimit-limit"]
    Remaining  = $Headers["x-ratelimit-remaining"]
    RetryAfter = $Headers["retry-after"]
    Body       = $ResponseBody
} | Format-List

# Check for required fields in response body
if ($ResponseBody -and ($ResponseBody -match 'reasonIncorrect') -and ($ResponseBody -match 'reasonCorrect') -and ($ResponseBody -match 'technicalConcept') -and ($ResponseBody -match 'nextStep')) {
    Write-Host "Gate passed: required tutor fields present." -ForegroundColor Green
} else {
    Write-Warning "Gate failed: one or more required tutor fields missing in response body."
}
