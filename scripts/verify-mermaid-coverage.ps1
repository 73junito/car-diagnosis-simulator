#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$MermaidRequirements = @(
    @{ Area = "Student Dashboard"; File = "dashboard/student/ARCHITECTURE.md"; Concepts = @("Training", "Assessment", "Scenario", "Student") },
    @{ Area = "Scenario Workflow"; File = "dashboard/student/scenario/WORKFLOW.md"; Concepts = @("Question", "Submit", "Feedback", "Summary", "Grading") },
    @{ Area = "API Layer"; File = "torquemind-api/ARCHITECTURE.md"; Concepts = @("API", "Supabase", "Questions", "Grading", "Browser") },
    @{ Area = "Question Data"; File = "data/QUESTION-LIFECYCLE.md"; Concepts = @("Draft", "Validated", "Approved", "Provenance", "Citation") },
    @{ Area = "Citation Validator"; File = "scripts/CITATION-VALIDATOR.md"; Concepts = @("Source", "Chunk", "Hash", "Validation", "Evidence") },
    @{ Area = "Database Schema"; File = "supabase/DATABASE-ARCHITECTURE.md"; Concepts = @("question_provenance", "citation_validations", "approved_sources", "source_chunks") },
    @{ Area = "Database Migrations"; File = "db/migrations/MIGRATION-FLOW.md"; Concepts = @("Migration", "PostgreSQL", "RLS", "CI", "Rollback") },
    @{ Area = "Playwright Tests"; File = "tests/playwright/TEST-FLOWS.md"; Concepts = @("Fail-Closed", "Production", "Training", "Assessment", "Security") },
    @{ Area = "System Architecture"; File = "docs/SYSTEM-ARCHITECTURE.md"; Concepts = @("Student", "Instructor", "Dashboard", "API", "Database", "Citations") }
)

Write-Host ""
Write-Host "Verifying Mermaid Diagram Coverage" -ForegroundColor Cyan
Write-Host ""

$Results = @()
$FailureCount = 0

foreach ($Req in $MermaidRequirements) {
    $Area = $Req.Area
    $File = $Req.File
    $Concepts = $Req.Concepts
    
    Write-Host "Checking: $Area"
    
    if (-not (Test-Path $File -PathType Leaf)) {
        Write-Host "  [FAIL] File missing: $File" -ForegroundColor Red
        $FailureCount++
        $Results += [PSCustomObject]@{ Area = $Area; File = $File; Mermaid = "[NO]"; Concepts = "MISSING"; Result = "FAIL" }
        continue
    }
    
    Write-Host "  [OK] File found: $File" -ForegroundColor Green
    
    $Content = Get-Content $File -Raw
    $HasMermaid = $Content -match '```mermaid'
    
    if (-not $HasMermaid) {
        Write-Host "  [FAIL] No Mermaid diagram" -ForegroundColor Red
        $FailureCount++
    } else {
        Write-Host "  [OK] Mermaid diagram present" -ForegroundColor Green
    }
    
    $MissingConcepts = @($Concepts | Where-Object { $Content -notmatch [regex]::Escape($_) })
    
    if ($MissingConcepts.Count -eq 0) {
        Write-Host "  [OK] All required concepts" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Missing: $($MissingConcepts -join ', ')" -ForegroundColor Red
        $FailureCount++
    }
    
    Write-Host ""
    
    $Results += [PSCustomObject]@{
        Area = $Area
        File = (Split-Path -Leaf $File)
        Mermaid = if ($HasMermaid) { "[OK]" } else { "[NO]" }
        Concepts = if ($MissingConcepts.Count -eq 0) { "PASS" } else { "FAIL" }
        Result = if ($HasMermaid -and $MissingConcepts.Count -eq 0) { "PASS" } else { "FAIL" }
    }
}

Write-Host ""
Write-Host "Coverage Summary" -ForegroundColor Cyan
Write-Host ""
$Results | Format-Table -AutoSize @(
    @{ Label = "Area"; Expression = "Area"; Width = 25 },
    @{ Label = "File"; Expression = "File"; Width = 40 },
    @{ Label = "Mermaid"; Expression = "Mermaid"; Width = 8 },
    @{ Label = "Concepts"; Expression = "Concepts"; Width = 10 },
    @{ Label = "Result"; Expression = "Result"; Width = 8 }
)

Write-Host ""
if ($FailureCount -eq 0) {
    Write-Host "[PASS] All critical folders have Mermaid architecture documentation" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAIL] $FailureCount folder(s) missing documentation" -ForegroundColor Red
    exit 1
}
