$runId = 25590740017
$repo = '73junito/car-diagnosis-simulator'
Write-Host "Watching workflow run $runId in $repo..."
while ($true) {
  try {
    $raw = gh run view $runId --repo $repo --json status,conclusion,jobs
    $run = $raw | ConvertFrom-Json
  } catch {
    Write-Host "gh run view failed, retrying in 30s: $_"
    Start-Sleep -Seconds 30
    continue
  }
  Write-Host (Get-Date) "Run status: $($run.status)  conclusion: $($run.conclusion)"
  if ($run.jobs) {
    foreach ($job in $run.jobs) {
      $jc = $job.conclusion
      if (-not $jc) { $jc = 'PENDING' }
      Write-Host "Job: $($job.name) -> $jc"
      if ($job.steps) {
        foreach ($s in $job.steps) {
          $sc = $s.conclusion
          if (-not $sc) { $sc = 'PENDING' }
          Write-Host "  Step: $($s.number) - $($s.name) -> $sc"
        }
      }
    }
  }
  if ($run.status -eq 'completed') { break }
  Start-Sleep -Seconds 30
}

Write-Host 'Run completed. Final conclusion:' $run.conclusion

if ($run.conclusion -ne 'success') {
  Write-Host 'Collecting failure details...'
  $failedJobs = @()
  foreach ($job in $run.jobs) { if ($job.conclusion -ne 'success') { $failedJobs += $job } }
  foreach ($fj in $failedJobs) {
    Write-Host "Failed job: $($fj.name) (id: $($fj.id))"
    if ($fj.steps) {
      foreach ($s in $fj.steps) { if ($s.conclusion -ne 'success') { Write-Host "  Failed step: $($s.number) - $($s.name) -> $($s.conclusion)" } }
    }
    Write-Host 'Fetching logs for failed job (searching for ERROR lines)...'
    try {
      gh run view $runId --repo $repo --log --job $($fj.id) | Select-String -Pattern 'ERROR' -Context 0,3 | ForEach-Object { Write-Host $_.Line; if ($_.Context) { $_.Context | ForEach-Object { Write-Host $_ } } }
    } catch {
      Write-Host 'Failed to fetch logs for job: ' $_
    }
  }
} else {
  Write-Host 'Run succeeded — verifying release tag and GitHub Release...'
  $tag = 'v0.1.2'
  try {
    $tagInfo = gh api repos/$repo/git/ref/tags/$tag 2>$null | ConvertFrom-Json
    if ($tagInfo) { Write-Host "Tag $tag exists: $($tagInfo.ref)" }
  } catch { Write-Host "Tag $tag not found via git/ref/tags API" }
  try {
    $release = gh api repos/$repo/releases/tags/$tag 2>$null | ConvertFrom-Json
    if ($release) {
      Write-Host "Found release: $($release.html_url)"
      if ($release.assets -and $release.assets.Count -gt 0) { Write-Host 'Release assets:'; $release.assets | ForEach-Object { Write-Host "  $($_.name) -> $($_.browser_download_url)" } } else { Write-Host 'No release assets found' }
    }
  } catch { Write-Host 'No GitHub Release found for tag' }
}
Write-Host 'Done.'
