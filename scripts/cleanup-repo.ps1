<#
Safe repository cleanup script for TorqueMind.
Removes generated artifacts and experimental directories listed in the project's cleanup plan.
Run from repository root in PowerShell: `./scripts/cleanup-repo.ps1`
This script only removes paths that exist and is intentionally conservative.
#>

$paths = @(
    '.wrangler',
    'playwright-report',
    'test-results',
    'runs',
    'runs-artifacts-*',
    'downloaded-artifacts',
    'pwa-backup-*',
    '.checkpoints'
)

Write-Host "Starting safe cleanup..."

foreach ($p in $paths) {
    $matches = Get-ChildItem -Path $p -Force -Recurse -Directory -Name -ErrorAction SilentlyContinue
    if (-not $matches) {
        # Try wildcard path directly
        if (Test-Path -Path $p) {
            Write-Host "Removing path: $p"
            Remove-Item -Path $p -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            Write-Host "Not found: $p"
        }
    } else {
        foreach ($m in $matches) {
            $full = Join-Path -Path (Get-Location) -ChildPath $m
            Write-Host "Removing match: $full"
            Remove-Item -Path $m -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "Cleanup complete. Review the changes and commit if desired."
