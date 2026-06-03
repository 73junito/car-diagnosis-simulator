$token = gh auth token
if (-not $token) {
  Write-Error 'No gh token available'
  exit 2
}
$body = @{
  event_type = 'append-history'
  client_payload = @{
    run_id = 'manual-verify-ps'
    ref = 'main'
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri 'https://api.github.com/repos/73junito/car-diagnosis-simulator/dispatches' -Method Post -Headers @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json' } -Body $body -ContentType 'application/json' -ErrorAction Stop
Write-Output 'dispatched' 
