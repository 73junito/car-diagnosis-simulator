param(
  [int]$pr = 124,
  [string]$repo = '73junito/car-diagnosis-simulator',
  [int]$timeoutMinutes = 20
)

$end = (Get-Date).AddMinutes($timeoutMinutes)
Write-Output "Watching PR #$pr required checks on repo $repo (timeout ${timeoutMinutes}m)..."
while((Get-Date) -lt $end){
  try{
    $checksJson = gh pr checks $pr --repo $repo --required --json name,state,link 2>$null
    if (-not $checksJson){ Write-Output 'No required checks found yet; retrying...'; Start-Sleep -Seconds 8; continue }
    $checks = $checksJson | ConvertFrom-Json
    $running = $checks | Where-Object { $_.state -in @('IN_PROGRESS','PENDING','') }
    if ($running -and $running.Count -gt 0){
      Write-Output ('Waiting — running: ' + ($running | ForEach-Object { $_.name } | Sort-Object -Unique -join ', '))
      Start-Sleep -Seconds 10; continue
    }
    # no running checks — examine results
    $failed = $checks | Where-Object { $_.state -ne 'SUCCESS' }
    if (-not $failed -or $failed.Count -eq 0){
      Write-Output 'All required checks succeeded.'; exit 0
    } else {
      Write-Output 'Some required checks did not succeed:'
      $failed | ForEach-Object { Write-Output ("- $($_.name): $($_.state) -> $($_.link)") }
      exit 3
    }
  } catch {
    Write-Output "Error polling checks: $_"; Start-Sleep -Seconds 8; continue
  }
}
Write-Output 'Timeout waiting for required checks'; exit 2
