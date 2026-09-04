# Evidence Mapping Workstream: Gate 4 Readiness

## Executive Summary

The student dashboard UX and routing are now production-stable (PR #409, #410, #411 merged). The next critical gate is **evidence readiness**: ensuring all 21 scenarios have approved, validated citations backing their assessment questions.

**Current Status**: Fail-closed by design. No assessment questions render without complete evidence mapping. The database has the schema and tooling, but the question-to-evidence linkage is incomplete.

**Blocker**: 22 scenario_questions exist but have `question_id = NULL`. Without question_id, questions cannot link to `question_provenance`, which blocks the entire evidence chain (citations → validations → release gate).

---

## Gate 4 Audit Results (Staging)

| Metric | Value | Status |
|--------|-------|--------|
| Approved sources | 2 | ✓ |
| Approved source chunks | 5 | ✓ |
| Scenario catalog records | 18 | ⚠ Design pending |
| Live student scenarios (UI) | 21 | ✓ |
| Scenario questions | 22 | ⚠ Partial |
| Questions with populated `question_id` | 0 | ✗ All NULL |
| Provenance records | 22 | ⚠ Orphaned |
| Provenance that links to questions | 0 | ✗ No join |
| Citation records | 12 | ⚠ No attribution |
| Fully valid citation validations | 6 | ⚠ No chain |

**Note**: The database catalog currently has 18 category-style IDs. The UI exposes 21 scenario_keys. The mapping architecture (1:1 direct, lookup table, rename catalog.scenario_id to match scenario_key, etc.) is pending design decision. Do NOT commit to specific catalog structure until this is finalized.

### Key Blockers

1. **Broken Question-Provenance Link** (CONFIRMED BLOCKER)
   - 22 `scenario_questions` rows have `question_id = NULL`
   - 22 `question_provenance` rows exist but cannot link (no match on `question_id`)
   - Release gate requires `JOIN ON p.question_id = q.question_id`, which returns 0 rows
   - **Status**: Must backfill question_ids before any other progress

2. **Catalog Identity Model Undefined** (DESIGN DECISION REQUIRED)
   - Database `scenario_catalog` has 18 entries with category-style IDs
   - Production `SCENARIO_REGISTRY` exposes 21 scenarios with scenario_keys
   - Decision required: Will catalog adopt scenario_key as primary identity, or use a mapping table?
   - **Status**: Defer catalog DDL changes until this design is finalized
   - **Do NOT assume**: "21 catalog rows" or "catalog matches UI keys directly"

3. **No Attribution Chain** (CONSEQUENCE OF #1)
   - Citations exist but cannot be attributed to deliverable assessment questions
   - Citation validations have no path back to questions
   - Assessment cannot verify evidence before rendering questions
   - **Status**: Resolves once question_id is backfilled

---

## Correct Next Workstream: Data Integrity & Evidence Mapping

### Not Dashboard Changes

The visual card-image refresh, progress-tracking polish, or any other student UX changes should **not** be mixed with evidence work. Keep visual backlog items separate and sequenced after evidence gates.

### The Evidence Mapping PR

This workstream is **data integrity only**: no new questions, no scenario changes, no Worker deployments.

**Critical Safety Requirements**:
1. No `CREATE FUNCTION` statements in deployable migrations (prevents accidental deployment)
2. No `SECURITY DEFINER` in public schema (prevents public callable functions)
3. No hardcoded scenario lists in migrations (prevents brittle assumptions)
4. Design-first contracts, remediation second (not the other way around)
5. Explicit question-to-provenance crosswalk before backfilling (prevents orphaned IDs)

**Governed Remediation Sequence** (each step reviewed before proceeding):

1. **Create and Review Question-to-Provenance Crosswalk** (FIRST)
   - Document which of the 22 `question_provenance` rows corresponds to each `scenario_questions` row
   - Mapping is not 1:1 by order; requires explicit review
   - Deliverable: CSV or lookup table showing { scenario_questions.id → question_provenance.id }
   - Review gate: Approved by technical reviewer before step 2
   - **Status**: Ready to create; prerequisite for all subsequent work

2. **Decide Catalog Identity Model** (REQUIRED DESIGN DECISION)
   - Database catalog currently has 18 category-style IDs (e.g., "no-crank", "charging-system")
   - UI exposes 21 scenario_keys (including "hybrid-ev-17", "differential-speed-whine", etc.)
   - Decision: Will database catalog adopt scenario_key as primary identity, keep category IDs with a mapping table, or merge entries?
   - This decision gates step 4 (catalog reconciliation)
   - **Status**: Pending approval; do NOT implement catalog DDL until this is decided

3. **Backfill Question ID Values** (AFTER CROSSWALK APPROVED)
   - Use the crosswalk from step 1 to deterministically assign question_id to each question
   - Format: `{scenario_prefix}-{issue_type}-{index}` (e.g., `no-crank-battery-check-01`)
   - Update 22 `scenario_questions` rows with non-null question_id
   - Validate uniqueness within each scenario_id
   - Deliverable: Audit report showing before/after state
   - **Status**: Can begin once crosswalk is approved

4. **Reconcile Catalog with UI Scenarios** (AFTER IDENTITY DECISION)
   - Apply the catalog identity model decision from step 2
   - If scenario_key as primary: INSERT three missing entries for "differential-speed-whine", etc.
   - If mapping table: Create lookup linking scenario_key to existing catalog IDs
   - Verify all 21 active scenarios are represented
   - **Status**: Deferred until step 2 decision is made

5. **Link Provenance and Citations** (AFTER QUESTION_ID BACKFILL)
   - For each approved provenance, ensure at least one citation to approved source/chunk
   - Validate citation hashes and URL accessibility
   - Run citation validator over all approved provenance
   - Deliverable: Citation chain audit report
   - **Status**: Can begin once step 3 completes

6. **Validate in Staging** (BEFORE PRODUCTION)
   - Run all contract queries (supabase/contracts/evidence-mapping-contract.sql) against staging
   - Confirm all 5 contract stages are fulfilled (Identity, Question, Provenance, Citation, Release)
   - Deliverable: Green audit report on staging
   - **Status**: Gates production deployment

7. **Only Then Design Release-Gate Functions** (IF NEEDED)
   - After full validation, assess whether internal RPC functions are needed
   - If yes: Design as minimal, non-public, service_role only
   - Must not hardcode scenario lists or assume catalog structure
   - Must not expose answer keys, explanations, or evidence data
   - Deliverable: Reviewed RPC functions with security audit
   - **Status**: Post-validation; optional if queries suffice

---

## Evidence Mapping Contract

### Test Files

- **`tests/evidence-mapping-contract-static.spec.js`** (NEW)
  - Local artifact validation: verifies contract safety and documentation **without credentials**
  - Confirms SQL contract is outside deployable migrations (read-only)
  - Verifies no CREATE, ALTER, DROP, GRANT, INSERT, UPDATE, DELETE, or TRUNCATE statements in contract
  - Validates all five stages documented in workstream
  - Checks that staging credentials requirement is explicit in documentation
  - **Runs locally**: Does not require `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`
  - Complements the integration tests (below) by validating artifacts independently

- **`tests/evidence-mapping-contract.spec.js`** (NEW)
  - Integration test suite validating the 5-stage evidence-to-question contract **against live Supabase**
  - **Requires staging credentials**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables
  - Stage 1: Identity (catalog-to-scenario mapping)
  - Stage 2: Question (non-null, unique question_id)
  - Stage 3: Provenance (question-to-provenance linkage)
  - Stage 4: Citation (approved citations with full validation)
  - Stage 5: Release (fail-closed gate: zero questions render without full chain)
  - **Local behavior**: Tests are skipped when credentials are unavailable (no false failures)
  - **Staging behavior**: All 19 tests run when credentials are injected
  - Does NOT call RPC functions (functions do not exist yet)
  - Tests data state directly via Supabase client queries
  - **Note**: The local suite validates repository safety and skips staging-only evidence checks when credentials are unavailable. Staging credentials are required to execute the 19 evidence-integrity assertions.

### Design SQL Files

- **`supabase/contracts/evidence-mapping-contract.sql`** (NEW, NOT DEPLOYABLE)
  - Location: `supabase/contracts/` (NOT `migrations/`), preventing accidental deployment
  - Content: Design-only read-only queries (no CREATE FUNCTION, no SECURITY DEFINER, no GRANT)
  - Purpose: Documents what the database state should be when contract is fulfilled
  - Queries (6 design queries):
    1. Verify no questions with NULL question_id
    2. Verify question-to-provenance linkage (exactly 1 approved per question)
    3. Verify approved provenance has citations to approved sources/chunks
    4. Verify citations have complete valid validation (all flags true)
    5. Verify assessment readiness (fail-closed gate: complete evidence chain)
    6. Audit diagnostic showing which stages block each scenario
  - No hardcoded scenario lists or assumptions
  - Can be safely executed read-only against staging/production for auditing

### Migration Files

- **`supabase/migrations/20260905001000_evidence_mapping_contract_functions.sql`** (NEW)
  - SQL functions for audit queries (all service-role only)
  - `count_unmapped_questions()` — questions with NULL question_id
  - `unmapped_provenance_count()` — provenance without citations
  - `questions_available_for_assessment()` — count of evidence-backed questions per scenario
  - `fully_validated_questions_by_scenario()` — fail-closed release gate
  - `assessment_ready_scenarios()` — which scenarios are ready
  - `gate4_readiness_matrix()` — comprehensive audit view
  - `evidence_gap_diagnosis()` — detailed gap report per scenario

### RLS Policy Changes

No new policies needed yet (evidence is service-role only). If browser-facing evidence API is added later, RLS policies will restrict to:
- Published evidence only
- No answer keys or explanations
- Fail-closed by default

---

## Staging Verification (Read-Only)

To run the audit queries in **staging Supabase SQL Editor** without changing the database:

```sql
-- Current broken state: zero evidence-backed questions
SELECT * FROM public.gate4_readiness_matrix() ORDER BY scenario_id;

-- Detailed gap diagnosis
SELECT * FROM public.evidence_gap_diagnosis() ORDER BY scenario_id, gap_type;

-- Available assessment questions (should be zero)
SELECT * FROM public.questions_available_for_assessment() ORDER BY scenario_id;
```

Expected result:
```
scenario_id             | gate_ready | fully_ready
-----------------------+------------+-------------
automatic-transmission | false      | 0
can-bus-network         | false      | 0
...
no-crank                | false      | 0
charging-system         | false      | 0
...
```

---

## Files Affected (This PR)

### New Files (Contract)
- `tests/evidence-mapping-contract.spec.js` — Test suite for mapping invariants
- `supabase/migrations/20260905001000_evidence_mapping_contract_functions.sql` — RPC functions

### To Be Modified (In the Evidence Mapping PR)
- `supabase/migrations/20260905001001_backfill_question_ids.sql` (NEW) — Populate question_id column
- `supabase/migrations/20260905001002_reconcile_scenario_catalog.sql` (NEW) — Add 3 missing scenarios
- `supabase/migrations/20260905001003_attach_approved_evidence.sql` (NEW) — Link citations to approved provenance
- Possibly: `db/migrations` or fixture updates
- Possibly: Test data fixtures in `tests/` to verify the mapping

### Configuration Files (if needed)
- `jest.config.js` — May need to add test file patterns for evidence suite
- `wrangler.app.jsonc` — No changes (evidence is database only)

---

## Recommended PR Structure

### Branch: `audit/gate4-evidence-mapping`
- **Commit 1**: Add evidence-mapping contract (test file + SQL RPC functions)
- **Commit 2**: Backfill question_ids for no-crank and charging-system scenarios
- **Commit 3**: Reconcile scenario_catalog with live 21 scenarios
- **Commit 4**: Attach approved citations and run validator
- **Commit 5**: Verify gate4_readiness_matrix() reports complete mapping

### CI Gates
- Jest tests must pass (no app code changes)
- Linting must pass
- No database writes during PR (data changes via explicit migration only)
- Post-merge: Manual verification in staging that gate4_readiness_matrix() shows gate_ready = true for all scenarios

---

## Next Immediate Actions

1. **Run staging audit** (read-only) to confirm current gaps match reported blockers
2. **Create backfill SQL** for question_ids based on existing provenance matching logic
3. **Create catalog reconciliation** to add the 3 missing scenarios
4. **Run citation validator** over all approved provenance
5. **Commit to branch** and verify CI passes
6. **Post-merge verification**: Re-run gate4_readiness_matrix() in staging to confirm all scenarios report gate_ready = true

---

## Success Criteria

✅ **Definition of Done**:
- [ ] `count_unmapped_questions()` returns zero rows
- [ ] `unmapped_provenance_count()` returns zero rows
- [ ] `gate4_readiness_matrix()` reports `gate_ready = true` for all 21 scenarios
- [ ] `questions_available_for_assessment()` reports question counts > 0 for all scenarios
- [ ] `evidence_gap_diagnosis()` returns zero rows
- [ ] Jest suite passes (103 suites, 507 tests)
- [ ] Lint passes
- [ ] All 21 scenarios have catalog entries
- [ ] All scenario_questions have non-null question_id
- [ ] All question_id values link to question_provenance
- [ ] All approved provenance have validated citations

---

## Rollback Plan

If evidence mapping breaks a scenario:
1. Revert the backfill commits
2. Restore question_id = NULL state
3. Re-run gate4_readiness_matrix() to confirm zero ready scenarios (fail-closed)
4. No student impact (questions never rendered)

---

## Related Documents

- `EVIDENCE-GATED-GENERATOR-APPLIED.md` — Prior evidence ingestion
- `NO-CRANK-HUMAN-PASSAGE-ATTESTATION.json` — Evidence attestation
- `PRODUCTION_READINESS_CHECKLIST.md` — Release gates
- `supabase/verification/03_gate4_readiness.sql` — Release gate query
