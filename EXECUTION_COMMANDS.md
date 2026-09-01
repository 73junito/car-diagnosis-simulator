# TTED-805 Execution Commands (Corrected)

**Start here after applying the Supabase migration**

---

## 1. Populate Citation Validations (Secure PowerShell)

**Copy-paste this entire block:**

```powershell
Set-Location F:\TorqueMind

$env:SUPABASE_URL = "https://pffdgqpynpbffbcnxmum.supabase.co"

$SecureServiceKey = Read-Host `
    "Enter Supabase service-role key" `
    -AsSecureString

$ServiceKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
    $SecureServiceKey
)

try {
    $env:SUPABASE_SERVICE_KEY = [
        Runtime.InteropServices.Marshal
    ]::PtrToStringBSTR($ServiceKeyPointer)

    node .\scripts\validate-citations.js `
        --scenario no-crank `
        --dry-run

    if ($LASTEXITCODE -ne 0) {
        throw "Citation-validator dry run failed"
    }

    node .\scripts\validate-citations.js `
        --scenario no-crank

    if ($LASTEXITCODE -ne 0) {
        throw "Citation-validation population failed"
    }
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR(
        $ServiceKeyPointer
    )

    Remove-Item Env:SUPABASE_SERVICE_KEY `
        -ErrorAction SilentlyContinue
}
```

**Expected Output:**
```
[Validator Output]
Total questions processed: 20
Valid citations: 20
Invalid citations: 0
Status: PASS
```

---

## 2. Verify API (Check 20 Questions Returned)

```powershell
$PublishableKey = "sb_publishable_izHdW-8uSXDyOoroubUoDA_ZqnW16cw"

$Headers = @{
    apikey        = $PublishableKey
    Authorization = "Bearer $PublishableKey"
}

$ValidationResponse = Invoke-RestMethod `
    -Uri "https://pffdgqpynpbffbcnxmum.supabase.co/rest/v1/citation_validations?select=result" `
    -Headers $Headers

"Validation records: $($ValidationResponse.Count)"

$ValidationResponse | Group-Object result | Select-Object Name, Count
```

**Expected Output:**
```
Validation records: 20

Name  Count
----  -----
valid    20
```

---

## 3. Start Server and Test Dashboard

**Terminal 1: Start server**
```powershell
Set-Location F:\TorqueMind\torquemind-api

$env:SUPABASE_URL = "https://pffdgqpynpbffbcnxmum.supabase.co"
$env:SUPABASE_ANON_KEY = "sb_publishable_izHdW-8uSXDyOoroubUoDA_ZqnW16cw"
$env:PORT = "3003"

node ./index.js
```

**Terminal 2: Test endpoint**
```powershell
$QuestionResponse = Invoke-RestMethod `
    "http://127.0.0.1:3003/api/scenario-questions-approved?scenario_id=no-crank"

$Questions = @($QuestionResponse.questions)

[PSCustomObject]@{
    QuestionsReturned = $Questions.Count
    ValidatedQuestions = @($Questions | Where-Object { 
        $_.question_provenance.citation_validation.result -eq 'valid' 
    }).Count
} | Format-List

if ($Questions.Count -ne 20) {
    throw "FAIL: Expected 20 questions, got $($Questions.Count)"
}
```

**Expected Output:**
```
QuestionsReturned   : 20
ValidatedQuestions  : 20
```

---

## 4. Run Playwright Tests (NOT npm test)

**Stop the server first (Ctrl-C in Terminal 1), then:**

```powershell
Set-Location F:\TorqueMind

# Both tests must pass
npx playwright test `
    tests/playwright/tted805-no-crank-fail-closed.spec.js `
    tests/playwright/tted805-no-crank-production-readiness.spec.js `
    --project=chromium `
    --reporter=list `
    --trace=retain-on-failure

if ($LASTEXITCODE -ne 0) {
    throw "Playwright tests failed"
}
```

**Expected Output:**
```
✓ tted805-no-crank-fail-closed.spec.js (all tests)
✓ tted805-no-crank-production-readiness.spec.js (all tests)

Tests: 2 passed
```

---

## 5. Run Final Validation Pipeline

```powershell
Set-Location F:\TorqueMind

# Mermaid verification
npm run docs:mermaid
if ($LASTEXITCODE -ne 0) { throw "Mermaid failed" }

# Jest tests
npm test
if ($LASTEXITCODE -ne 0) { throw "Jest failed" }

# Build
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }
```

**Expected Output:**
```
Mermaid:
[PASS] Successfully rendered 11 Mermaid diagrams to SVG

Jest:
Test Suites: 101 passed, 101 total
Tests:       474 passed, 474 total

Build: (depends on build process - exit code 0)
```

---

## ⚠️ CRITICAL CORRECTIONS FROM ORIGINAL GUIDE

### ❌ WRONG: Assigning SecureString to env var
```powershell
$env:SUPABASE_SERVICE_KEY = Read-Host -AsSecureString
# ❌ This creates a SecureString object, Node.js expects plaintext
```

### ✅ CORRECT: Convert SecureString to plaintext safely
```powershell
$ServiceKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
    $SecureServiceKey
)
$env:SUPABASE_SERVICE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
    $ServiceKeyPointer
)
# ✅ Plaintext in environment, then secure cleanup
```

### ❌ WRONG: Use `npm test` for Playwright
```powershell
npm test -- tests/playwright/tted805-no-crank-production-readiness.spec.js
# ❌ npm test runs Jest, not Playwright
```

### ✅ CORRECT: Use `npx playwright test`
```powershell
npx playwright test tests/playwright/tted805-no-crank-production-readiness.spec.js
# ✅ npx playwright test runs Playwright
```

---

## 📋 Success Criteria (DO NOT SKIP)

**Do NOT claim production readiness until you see:**

```
[PASS] Citation validator: 20 valid, 0 invalid
[PASS] API: 20 questions returned
[PASS] Playwright fail-closed: 0 cards (when not validated)
[PASS] Playwright production: 20 cards (when validated)
[PASS] Jest: 474/474 tests passing
[PASS] Build: Exit code 0
[PASS] Mermaid: 11/11 diagrams rendered
```

---

## 🔍 Debugging Quick Links

- **Table doesn't exist?** See SUPABASE_MIGRATION_GUIDE.md Step 1
- **API returns 0 questions?** Check citation_validations has 20 records
- **Playwright test fails?** Make sure server is NOT running (stop it before tests)
- **Jest fails?** Run `npm test 2>&1 | tail -50` to see last 50 lines
- **Build fails?** Check `npm run build 2>&1 | grep error`

---

## 📞 Key Resources

- **Migration Guide**: SUPABASE_MIGRATION_GUIDE.md
- **Readiness Checklist**: PRODUCTION_READINESS_CHECKLIST.md
- **Session Status**: SESSION_STATUS_REPORT.md
- **Mermaid Fix Details**: (Previous commit with verification results)
