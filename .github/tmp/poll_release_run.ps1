param([string]$runId = '26195940918')

while ($true) {
  $sJson = gh run view $runId --repo 73junito/car-diagnosis-simulator --json status,conclusion
  $s = $sJson | ConvertFrom-Json
  if ($null -ne $s.conclusion) { $conc = $s.conclusion } else { $conc = '' }
  Write-Host ("Status: " + $s.status + ", Conclusion: " + $conc)
  if ($s.status -ne "in_progress") { break }
  Start-Sleep -Seconds 5
}

gh run view $runId --repo 73junito/car-diagnosis-simulator --json status,conclusion
