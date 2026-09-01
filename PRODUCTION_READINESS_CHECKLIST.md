# TTED-805 Production Readiness Checklist

**Purpose**: Explicit verification that all systems work end-to-end before claiming production readiness.

**Do NOT claim production readiness until ALL items below show PASS**

---

## ✅ Required Verification Results

### 1. Supabase Infrastructure
```
[ ] citation_validations table exists
    Query: select to_regclass('public.citation_validations')
    Expected: public.citation_validations (not null)

[ ] RLS policies created
    Query: select count(*) from pg_policies where tablename='citation_validations'
    Expected: 2 policies (authenticated + anon)

[ ] Table is empty at start (before validator runs)
    Query: select count(*) from public.citation_validations
    Expected: 0 records
```

### 2. Citation Validator - Dry Run
```
[ ] Dry-run completes without writing to database
    Command: node scripts/validate-citations.js --scenario no-crank --dry-run
    Expected: Exit code 0
             Output shows: "20 valid, 0 invalid"
             Database: Still 0 records (no writes)
```

### 3. Citation Validator - Database Population
```
[ ] Validator writes 20 valid records to database
    Command: node scripts/validate-citations.js --scenario no-crank
    Expected: Exit code 0
             Output shows: "Inserted 20 citation_validations records"
    
[ ] Database records match expected format
    Query: select id, question_provenance_id, result, source_hashes_verified, 
                   excerpts_verified, urls_verified
            from citation_validations
            where question_provenance_id in (
              select id from question_provenance where scenario_id='no-crank'
            )
            limit 1
    Expected: All flags = true, result = 'valid'
```

### 4. API Layer - Data Access
```
[ ] 20 validation records exist in database
    Query: select count(*) from citation_validations
    Expected: 20

[ ] API endpoint returns 20 approved questions
    Command: curl http://127.0.0.1:3003/api/scenario-questions-approved?scenario_id=no-crank
    Expected: {"questions": [...20 items...], "total": 20}

[ ] Each question has citation_validation attached
    Command: Verify response structure
    Expected: question.question_provenance.citation_validation.result = 'valid'
             for all 20 questions
```

### 5. Dashboard - UI Layer
```
[ ] Dashboard displays all 20 questions
    Manual: Navigate to /dashboard/student/no-crank
    Expected: 20 question cards rendered

[ ] No answer keys exposed
    Manual: View page source / network inspector
    Expected: answer_key fields not visible in API responses
             Only question text, multiple choice options visible
```

### 6. Test Suite - Playwright E2E
```
[ ] Fail-closed test passes (0 cards when no validation)
    Command: npx playwright test tests/playwright/tted805-no-crank-fail-closed.spec.js
    Expected: PASS
             Verifies: 0 questions when citation_validations empty

[ ] Production-readiness test passes (20 cards when validated)
    Command: npx playwright test tests/playwright/tted805-no-crank-production-readiness.spec.js
    Expected: PASS
             Verifies: 20 questions when citation_validations populated
```

### 7. Test Suite - Jest
```
[ ] All Jest tests pass
    Command: npm test
    Expected: Exit code 0
             Test Suites: 101 passed, 101 total
             Tests:       474 passed, 474 total
```

### 8. Build Pipeline
```
[ ] Build completes successfully
    Command: npm run build
    Expected: Exit code 0
             No errors in output
             dist/ folder created (if applicable)
```

### 9. Documentation Verification
```
[ ] All Mermaid diagrams render
    Command: npm run docs:mermaid
    Expected: Exit code 0
             All 11 diagrams rendered to SVG
             Coverage: 9/9 folders verified
             Rendering: 11/11 diagrams to SVG
             Summary: [PASS]
```

---

## 📋 Full Test Sequence

### Prerequisites
- [ ] Supabase migration applied to database
- [ ] citation_validations table created and empty
- [ ] RLS policies configured
- [ ] Node.js environment ready

### Step 1: Validator Testing
```powershell
# Dry-run (no writes)
node scripts/validate-citations.js --scenario no-crank --dry-run
# Expected: PASS, 0 database changes

# Populate (with writes)
node scripts/validate-citations.js --scenario no-crank
# Expected: PASS, 20 records written
```

### Step 2: API Verification
```powershell
# Start server
Set-Location torquemind-api
node index.js

# Test endpoint (in another terminal)
Invoke-RestMethod http://127.0.0.1:3003/api/scenario-questions-approved?scenario_id=no-crank
# Expected: 20 questions

# Verify each has citation_validation
# Expected: All have result='valid'
```

### Step 3: E2E Tests
```powershell
# Both Playwright tests
npx playwright test `
  tests/playwright/tted805-no-crank-fail-closed.spec.js `
  tests/playwright/tted805-no-crank-production-readiness.spec.js `
  --project=chromium
# Expected: 2/2 PASS
```

### Step 4: Full Pipeline
```powershell
npm run docs:mermaid      # Expected: PASS, 11/11 rendered
npm test                  # Expected: PASS, 474/474 tests
npm run build             # Expected: PASS, exit 0
```

---

## 🚩 Failure Scenarios

### If Citation Validator Fails
- Check SUPABASE_SERVICE_KEY is set and valid
- Check table exists: `select to_regclass('public.citation_validations')`
- Check question_provenance has 20 records for scenario_id='no-crank'
- Run dry-run first to isolate syntax issues

### If API Returns 0 Questions
- Check citation_validations has 20 records
- Check RLS policies are configured (read-only for valid records)
- Check question_provenance IDs match in both tables
- Verify SUPABASE_ANON_KEY is set

### If Playwright Tests Fail
- Check API is running on port 3003
- Check dashboard can load the scenario
- Check 20 questions actually render as cards
- Check network tab shows correct API responses

### If Jest Fails
- Run specific failing test in isolation
- Check environment variables are set
- Check database connection string
- Check no file system changes broke imports

### If Build Fails
- Check all files compile (no syntax errors)
- Check all imports resolve
- Check package.json dependencies installed
- Check no uncommitted changes to source

---

## ✅ Sign-Off Criteria

**Production readiness is confirmed when:**

```
✓ citation_validations table exists in Supabase
✓ Validator dry-run: 20 valid, 0 invalid
✓ Database writes: 20 evidence records inserted
✓ API: /api/scenario-questions-approved returns 20 questions
✓ Dashboard: 20 question cards displayed
✓ Answer keys: 0 exposed (verified in network inspector)
✓ Playwright fail-closed: PASS (0 cards initially)
✓ Playwright production: PASS (20 cards after validation)
✓ Jest: 474/474 tests passing
✓ Build: Exit code 0, no errors
✓ Mermaid: 11/11 diagrams rendered to SVG
```

**All checks must show PASS before deploying to production**

---

## 📊 Expected Outcomes

| Component | Status | Evidence |
|-----------|--------|----------|
| Supabase Infrastructure | ✅ | Table created, RLS active |
| Citation Validator | ✅ | 20/20 valid records |
| API Layer | ✅ | 20 questions returned |
| Dashboard UI | ✅ | 20 cards displayed |
| Security (RLS) | ✅ | 0 answer keys exposed |
| Playwright Tests | ✅ | 2/2 passing |
| Jest Suite | ✅ | 474/474 passing |
| Build Pipeline | ✅ | Exit code 0 |
| Documentation | ✅ | 11/11 Mermaid diagrams |

---

## 🔒 Security Verification

Confirm fail-closed behavior:

```
Scenario 1: No validation records
→ API returns: 0 questions
→ Dashboard shows: 0 cards
→ Security: PASS (fail-closed)

Scenario 2: With validation records
→ API returns: 20 questions
→ Dashboard shows: 20 cards with answer keys: HIDDEN
→ Security: PASS (no exposure)

Scenario 3: Invalid validation records
→ API returns: 0 questions (RLS filters them out)
→ Dashboard shows: 0 cards
→ Security: PASS (fail-closed)
```

---

## 📅 Timeline

- [ ] Supabase migration applied
- [ ] Citation validator population completed
- [ ] All verifications passed
- [ ] Ready for production deployment

**Date Completed**: _______________
**Verified By**: _______________
