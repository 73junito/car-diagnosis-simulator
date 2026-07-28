[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Get-Location).Path,
    [string]$OutputDirectory = "docs/architecture/inventory"
)

$ErrorActionPreference = "Stop"

$RepositoryRoot = (Resolve-Path $RepositoryRoot).Path
$OutputPath = Join-Path $RepositoryRoot $OutputDirectory

New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null

$CandidateRoots = @(
    ".github/agents",
    ".github/skills",
    ".ai",
    "ai-os",
    "skills",
    "prompts",
    "src/agents",
    "src/core/agents",
    "tools/ai"
)

$ExistingRoots = foreach ($RelativePath in $CandidateRoots) {
    $AbsolutePath = Join-Path $RepositoryRoot $RelativePath

    if (Test-Path $AbsolutePath) {
        [PSCustomObject]@{
            RelativePath = $RelativePath
            AbsolutePath = $AbsolutePath
            Type         = if ((Get-Item $AbsolutePath).PSIsContainer) {
                "Directory"
            }
            else {
                "File"
            }
        }
    }
}

$ExistingRoots |
    Sort-Object RelativePath |
    Export-Csv `
        (Join-Path $OutputPath "ai-roots.csv") `
        -NoTypeInformation `
        -Encoding utf8

$Files = foreach ($Root in $ExistingRoots) {
    if ($Root.Type -ne "Directory") {
        continue
    }

    Get-ChildItem $Root.AbsolutePath -Recurse -File -Force |
        Where-Object {
            $_.FullName -notmatch '[\\/](node_modules|dist|build|coverage|playwright-report|test-results)[\\/]'
        } |
        ForEach-Object {
            $RelativeFile = [System.IO.Path]::GetRelativePath(
                $RepositoryRoot,
                $_.FullName
            ).Replace('\', '/')

            $Hash = $null

            try {
                $Hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
            }
            catch {
                $Hash = "HASH_FAILED"
            }

            [PSCustomObject]@{
                Root          = $Root.RelativePath
                RelativePath  = $RelativeFile
                Extension     = $_.Extension
                SizeBytes     = $_.Length
                LastWriteTime = $_.LastWriteTimeUtc.ToString("o")
                SHA256        = $Hash
            }
        }
}

$Files |
    Sort-Object Root, RelativePath |
    Export-Csv `
        (Join-Path $OutputPath "ai-files.csv") `
        -NoTypeInformation `
        -Encoding utf8

$DuplicateGroups = $Files |
    Where-Object {
        $_.SizeBytes -gt 0 -and
        $_.SHA256 -and
        $_.SHA256 -ne "HASH_FAILED"
    } |
    Group-Object SHA256 |
    Where-Object Count -gt 1

$DuplicateRows = foreach ($Group in $DuplicateGroups) {
    foreach ($File in $Group.Group) {
        [PSCustomObject]@{
            SHA256       = $Group.Name
            DuplicateSet = $Group.Count
            Root         = $File.Root
            RelativePath = $File.RelativePath
            SizeBytes    = $File.SizeBytes
        }
    }
}

$DuplicateRows |
    Sort-Object SHA256, RelativePath |
    Export-Csv `
        (Join-Path $OutputPath "ai-duplicate-files.csv") `
        -NoTypeInformation `
        -Encoding utf8

$ExtensionSummary = $Files |
    Group-Object Extension |
    ForEach-Object {
        [PSCustomObject]@{
            Extension  = if ($_.Name) { $_.Name } else { "[none]" }
            FileCount  = $_.Count
            TotalBytes = ($_.Group | Measure-Object SizeBytes -Sum).Sum
        }
    } |
    Sort-Object FileCount -Descending

$ExtensionSummary |
    Export-Csv `
        (Join-Path $OutputPath "ai-extension-summary.csv") `
        -NoTypeInformation `
        -Encoding utf8

$RootSummary = foreach ($Root in $ExistingRoots) {
    $RootFiles = @($Files | Where-Object Root -eq $Root.RelativePath)

    [PSCustomObject]@{
        Root       = $Root.RelativePath
        FileCount  = $RootFiles.Count
        TotalBytes = if ($RootFiles.Count) {
            ($RootFiles | Measure-Object SizeBytes -Sum).Sum
        }
        else {
            0
        }
    }
}

$RootSummary |
    Sort-Object Root |
    Export-Csv `
        (Join-Path $OutputPath "ai-root-summary.csv") `
        -NoTypeInformation `
        -Encoding utf8

$SearchTerms = @(
    ".github/agents",
    ".github/skills",
    ".ai",
    "ai-os",
    "src/agents",
    "src/core/agents",
    "tools/ai",
    "skills/",
    "prompts/",
    "AgentRegistry",
    "SkillRegistry",
    "PromptRegistry"
)

$ReferenceReport = Join-Path $OutputPath "ai-references.txt"
$ReferenceLines = [System.Collections.Generic.List[string]]::new()

foreach ($Term in $SearchTerms) {
    $ReferenceLines.Add("=" * 80)
    $ReferenceLines.Add("SEARCH TERM: $Term")
    $ReferenceLines.Add("=" * 80)

    $Results = & git -C $RepositoryRoot grep -n -I -- $Term 2>$null

    if ($LASTEXITCODE -eq 0 -and $Results) {
        foreach ($Result in $Results) {
            $ReferenceLines.Add($Result)
        }
    }
    else {
        $ReferenceLines.Add("[NO TRACKED REFERENCES]")
    }

    $ReferenceLines.Add("")
}

$ReferenceLines | Set-Content $ReferenceReport -Encoding utf8

$PackageFiles = @(
    "package.json",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "pnpm-lock.yaml",
    "yarn.lock"
)

$DependencyReport = Join-Path $OutputPath "ai-dependencies.txt"
$DependencyLines = [System.Collections.Generic.List[string]]::new()

foreach ($PackageFile in $PackageFiles) {
    $PackagePath = Join-Path $RepositoryRoot $PackageFile

    if (-not (Test-Path $PackagePath)) {
        continue
    }

    $DependencyLines.Add("=" * 80)
    $DependencyLines.Add("FILE: $PackageFile")
    $DependencyLines.Add("=" * 80)

    $Matches = Select-String `
        -Path $PackagePath `
        -Pattern 'openai|anthropic|ollama|langchain|llamaindex|ai-sdk|@ai-sdk|model|prompt|agent|embedding|vector' `
        -CaseSensitive:$false

    if ($Matches) {
        foreach ($Match in $Matches) {
            $DependencyLines.Add(
                "$($Match.Path):$($Match.LineNumber):$($Match.Line.Trim())"
            )
        }
    }
    else {
        $DependencyLines.Add("[NO AI-RELATED MATCHES]")
    }

    $DependencyLines.Add("")
}

$DependencyLines | Set-Content $DependencyReport -Encoding utf8

$MarkdownPath = Join-Path $OutputPath "ai-architecture-summary.md"

$Markdown = @(
    "# TorqueMind AI Architecture Inventory"
    ""
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
    ""
    "## Existing AI roots"
    ""
    "| Root | Files | Bytes |"
    "|---|---:|---:|"
)

foreach ($Row in ($RootSummary | Sort-Object Root)) {
    $Markdown += "| ``$($Row.Root)`` | $($Row.FileCount) | $($Row.TotalBytes) |"
}

$Markdown += @(
    ""
    "## Inventory outputs"
    ""
    "- ``ai-roots.csv``"
    "- ``ai-files.csv``"
    "- ``ai-root-summary.csv``"
    "- ``ai-extension-summary.csv``"
    "- ``ai-duplicate-files.csv``"
    "- ``ai-references.txt``"
    "- ``ai-dependencies.txt``"
    ""
    "## Initial classification"
    ""
    "No files should be moved or removed until each root is classified as one of:"
    ""
    "- Product runtime"
    "- Developer tooling"
    "- Prompt or skill content"
    "- Test support"
    "- Generated artifact"
    "- Historical or obsolete"
    ""
    "## Next action"
    ""
    "Review ownership, imports, runtime entry points, and duplicate content before proposing the canonical layout."
)

$Markdown | Set-Content $MarkdownPath -Encoding utf8

Write-Host ""
Write-Host "AI architecture inventory completed." -ForegroundColor Green
Write-Host "Output directory: $OutputPath"
Write-Host ""

$RootSummary | Format-Table -AutoSize
