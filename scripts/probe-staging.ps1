$StagingUrl = "https://car-diagnosis-simulator-staging.73junito.workers.dev"

$Body = @{
    scenario      = "Engine cranks but will not start."
    question      = "What should be checked first?"
    studentAnswer = "Replace the starter."
    correctAnswer = "Verify fuel delivery and ignition spark."
    topic         = "Engine Performance"
} | ConvertTo-Json -Compress

$status = $null
$headers = @{}
$content = $null
try {
    $Response = Invoke-WebRequest -Uri "$StagingUrl/api/torquemind-feedback" -Method POST -ContentType "application/json" -Body $Body -ErrorAction Stop
    $status = $Response.StatusCode
    $headers = $Response.Headers
    $content = $Response.Content
} catch {
    $e = $_.Exception
    if ($e -and $e.Response) {
        $resp = $e.Response
        try {
            $status = $resp.StatusCode.value__
        } catch {
            $status = $resp.StatusCode -as [int]
        }
        foreach ($k in $resp.Headers.Keys) { $headers[$k] = $resp.Headers[$k] }
        try {
            $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $content = $sr.ReadToEnd()
        } catch {
            $content = $e.Message
        }
    } else {
        $status = 0
        $content = $e.Message
    }
}

$result = [PSCustomObject]@{
    Status     = $status
    RequestId  = ($headers["x-request-id"] -join ",")
    Limit      = ($headers["x-ratelimit-limit"] -join ",")
    Remaining  = ($headers["x-ratelimit-remaining"] -join ",")
    RetryAfter = ($headers["retry-after"] -join ",")
    Body       = $content
}

$result | ConvertTo-Json -Compress
