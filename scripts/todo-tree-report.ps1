param(
    [string]$Root = "."
)

$exclude = '\\node_modules\\|\\.git\\|\\coverage\\|\\test-results\\|\\playwright-report\\|\\downloaded-artifacts\\|\\runs-artifacts-'

$patterns = @(
    'BUG',
    'SECURITY',
    'BLOCKED',
    'TODO',
    'TEST',
    'DOCS',
    'PERF',
    'REFACTOR',
    'RELEASE',
    'IDEA',
    'DONE'
)

$files = Get-ChildItem $Root -Recurse -File -Include *.js,*.html,*.css,*.md,*.json,*.yml,*.yaml |
    Where-Object { $_.FullName -notmatch $exclude }

$results = $files |
    Select-String -Pattern ("\b(" + ($patterns -join "|") + ")(\([^)]+\))?\s*[:\-]") |
    ForEach-Object {
        $tag = if ($_.Line -match '\b(BUG|SECURITY|BLOCKED|TODO|TEST|DOCS|PERF|REFACTOR|RELEASE|IDEA|DONE)') {
            $matches[1]
        } else {
            "UNKNOWN"
        }

        [pscustomobject]@{
            Tag  = $tag
            File = $_.Path.Replace((Resolve-Path $Root).Path + "\", "")
            Line = $_.LineNumber
            Text = $_.Line.Trim()
        }
    }

$results |
    Sort-Object Tag, File, Line |
    Format-Table -AutoSize

Write-Host "`nSummary" -ForegroundColor Cyan

$results |
    Group-Object Tag |
    Sort-Object Name |
    Select-Object Name, Count |
    Format-Table -AutoSize
