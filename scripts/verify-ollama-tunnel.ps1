param(
    [Parameter(Mandatory = $true)]
    [string]$TunnelHost
)

$ClientId = Read-Host "Cloudflare Access Client ID"
$SecureClientSecret = Read-Host "Cloudflare Access Client Secret" -AsSecureString
$ClientSecret = [System.Net.NetworkCredential]::new(
    "",
    $SecureClientSecret
).Password

$Headers = @{
    "CF-Access-Client-Id"     = $ClientId
    "CF-Access-Client-Secret" = $ClientSecret
}

try {
    Write-Host "Checking $TunnelHost/api/tags ..." -ForegroundColor Cyan
    $Tags = Invoke-WebRequest `
        -Uri "$TunnelHost/api/tags" `
        -Headers $Headers `
        -Method GET `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "Tags status: $($Tags.StatusCode)" -ForegroundColor Green

    $ChatBody = @{
        model = "gpt-oss:20b"
        messages = @(
            @{
                role    = "user"
                content = 'Reply only with {"status":"ok"}'
            }
        )
        stream = $false
    } | ConvertTo-Json -Depth 10

    Write-Host "Posting to $TunnelHost/api/chat ..." -ForegroundColor Cyan
    $Chat = Invoke-WebRequest `
        -Uri "$TunnelHost/api/chat" `
        -Headers $Headers `
        -Method POST `
        -ContentType "application/json" `
        -Body $ChatBody `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "Chat status: $($Chat.StatusCode)" -ForegroundColor Green
    Write-Host "Chat response:" -ForegroundColor Green
    Write-Host $Chat.Content
}
catch {
    Write-Error "Verification failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        try {
            $r = $_.Exception.Response
            $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
            Write-Host "Response body:" -ForegroundColor Yellow
            Write-Host $sr.ReadToEnd()
            $sr.Dispose()
        } catch { }
    }
    exit 1
}
finally {
    $ClientId = $null
    $ClientSecret = $null
    $SecureClientSecret = $null
    $Headers = $null
}
