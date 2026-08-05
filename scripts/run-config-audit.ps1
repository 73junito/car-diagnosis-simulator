$Patterns = @(
    'TORQUEMIND_AI_PROVIDER',
    'TORQUEMIND_AI_URL',
    'TORQUEMIND_AI_MODEL',
    'TORQUEMIND_AI_TIMEOUT_MS',
    'TORQUEMIND_AI_API_KEY',
    'OLLAMA_HOST',
    'OLLAMA_API_KEY',
    'localhost:11434',
    '127\.0\.0\.1:11434',
    'ollama\.com',
    'gpt-oss',
    'qwen',
    'llama3',
    'glm-',
    'your-provider',
    'your-model'
)

$Files = Get-ChildItem . `
    -Recurse `
    -File `
    -Force `
    -Include *.js,*.mjs,*.cjs,*.ts,*.tsx,*.json,*.jsonc,*.yaml,*.yml,*.toml,*.md,*.env,*.example,*.ps1 `
    -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\dist\\' -and
        $_.FullName -notmatch '\\.git\\' -and
        $_.FullName -notmatch '\\.wrangler\\' -and
        $_.FullName -notmatch '\\.vercel\\' -and
        $_.FullName -notmatch '\\.wrangler-dry-run\\' -and
        $_.FullName -notmatch '\\audit\\' -and
        $_.FullName -notmatch '\\.github\\tmp\\'
    }

$Matches = @()
foreach ($File in $Files) {
    $res = Select-String -Path $File.FullName -Pattern $Patterns -ErrorAction SilentlyContinue
    foreach ($m in $res) {
        $Text = $m.Line
        $Text = $Text -replace '(?i)(API_KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*["'']?[^"'',\s]+', '$1=<redacted>'
        $Matches += [PSCustomObject]@{
            File = (Resolve-Path $File.FullName).Path
            Line = $m.LineNumber
            Text = $Text.Trim()
        }
    }
}

if (-not (Test-Path .\audit)) { New-Item -ItemType Directory -Path .\audit | Out-Null }
$Matches | Sort-Object File,Line | Export-Csv .\audit\ollama-config-audit.csv -NoTypeInformation -Encoding UTF8
Write-Host "Audit written to .\audit\ollama-config-audit.csv with $($Matches.Count) matches." -ForegroundColor Green
