param(
    [string]$repo = '73junito/car-diagnosis-simulator',
    [int]$pr = 15,
    [int]$max = 60,
    [int]$delay = 10
)

$allPassed = $false
for ($i = 0; $i -lt $max; $i++) {
    $j = gh pr view $pr --repo $repo --json mergeable,mergeStateStatus,statusCheckRollup | ConvertFrom-Json
    $mergeable = $j.mergeable
    $mergeState = $j.mergeStateStatus
    $checks = $j.statusCheckRollup
    $allPassed = $true
    foreach ($c in $checks) {
        if ($c.__typename -eq 'StatusContext') {
            if ($c.state -ne 'SUCCESS') { $allPassed = $false; break }
        } else {
            if ($c.status -ne 'COMPLETED' -or $c.conclusion -ne 'SUCCESS') { $allPassed = $false; break }
        }
    }
    Write-Host ([string]::Format('Poll {0}: mergeable={1} mergeState={2} allPassed={3}', $i, $mergeable, $mergeState, $allPassed))
    if ($allPassed -and $mergeable -eq 'MERGEABLE') { break }
    Start-Sleep -Seconds $delay
}

if (-not ($allPassed -and $mergeable -eq 'MERGEABLE')) {
    Write-Error 'Timeout waiting for checks to pass'
    exit 2
}

if ($mergeState -eq 'BEHIND') {
    Write-Host 'Branch behind; merging origin/main into feature branch'
    git checkout feat/instructor-dashboard-api
    git fetch origin
    git merge origin/main --no-edit
    git push origin feat/instructor-dashboard-api
}

Start-Sleep -Seconds 3
$j = gh pr view $pr --repo $repo --json mergeable,mergeStateStatus,statusCheckRollup | ConvertFrom-Json
$mergeable = $j.mergeable
$mergeState = $j.mergeStateStatus
$checks = $j.statusCheckRollup
$allPassed = $true
foreach ($c in $checks) {
    if ($c.__typename -eq 'StatusContext') {
        if ($c.state -ne 'SUCCESS') { $allPassed = $false; break }
    } else {
        if ($c.status -ne 'COMPLETED' -or $c.conclusion -ne 'SUCCESS') { $allPassed = $false; break }
    }
}

Write-Host ([string]::Format('After update: mergeable={0} mergeState={1} allPassed={2}', $mergeable, $mergeState, $allPassed))
if (-not ($allPassed -and $mergeable -eq 'MERGEABLE')) {
    Write-Error 'Checks not passing after update'
    exit 3
}

Write-Host 'Attempting to merge PR now...'
gh pr merge $pr --repo $repo --merge
if ($LASTEXITCODE -ne 0) { Write-Error 'Merge failed'; exit 4 }
Write-Host 'PR merged successfully'
