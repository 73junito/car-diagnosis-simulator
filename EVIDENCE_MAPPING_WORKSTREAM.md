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

This workstream is **data integrity only**: no new questions, no scenario changes, and no Worker-code changes.

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
  - Stage 3: Provenance (question-to-provenance linkage, correct reviewer fields)
  - Stage 4: Citation (approved citations with full validation)
  - Stage 5: Release (fail-closed gate—**NOT YET VERIFIED**, test is skipped)
  - **Local behavior**: Tests are skipped when credentials are unavailable (no false failures)
  - **Staging behavior**: Tests run when credentials are injected; some tests are intentionally skipped because they require additional verification work
  - Tests data state directly via Supabase client queries (no RPC function calls)
  - **Skipped tests** (not yet verified in this PR):
    - Release-gate: Requires credentialed API testing to confirm zero questions render
    - RLS protection: Requires real Supabase anon/public key (hardcoded JWT in test is not valid)
    - These gaps are labeled explicitly in test code and documented in the unverified gaps section
  - **Note**: Credential-free local tests validate repository safety. Staging credentials are required to run evidence-integrity assertions. Some staging tests are intentionally skipped pending separate credentialed verification work.

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

### Out-of-Scope Future Work

No migration, RPC function, stored procedure, backfill, catalog reconciliation, or citation-validation job is included in this PR.

If remediation is approved later, each database-changing step must be proposed and reviewed in a separate PR after explicit stakeholder approval of the deterministic question-to-provenance crosswalk.

---

## Staging Verification (Read-Only Design Queries)

The 6 read-only contract queries in **`supabase/contracts/evidence-mapping-contract.sql`** document what stages of evidence readiness should look like when complete:

1. **Query 1** — Count questions with NULL question_id (Stage 2 blocker)
2. **Query 2** — Verify 1:1 question-to-provenance cardinality
3. **Query 3** — Check provenance→source→chunk linkage
4. **Query 4** — Validate all citation flags true (source_hashes_verified, excerpts_verified, urls_verified)
5. **Query 5** — Count evidence-backed questions per scenario
6. **Query 6** — Audit diagnostic: which stages block each scenario

These queries can be run **read-only** in staging Supabase SQL Editor to assess current gaps **without changing data**.

Current expected state (until Step 1 crosswalk approved):
- Query 1: Returns 22 rows (all scenario_questions have NULL question_id)
- Query 2: Returns 0 rows (no question-to-provenance links exist)
- Queries 3–6: Show blocked chains due to missing question_id linkage

---

## This PR: Review-Only Gate 4 Contract

**Scope (4 files)**:
- EVIDENCE_MAPPING_WORKSTREAM.md — This document
- supabase/contracts/evidence-mapping-contract.sql — 6 read-only design queries
- tests/evidence-mapping-contract.spec.js — 19 integration test assertions (skip locally, run in staging)
- tests/evidence-mapping-contract-static.spec.js — 9 local artifact validation tests

Cloudflare's repository integration may build and deploy the branch commit to the configured Worker environment. This PR itself contains no Worker-code, migration, seed, or database-write change.

**This PR does NOT**:
- ❌ Create migrations or deploy database DDL
- ❌ Create RPC functions or stored procedures
- ❌ Backfill question_id values
- ❌ Mutate scenario_catalog
- ❌ Attach citations or validate evidence
- ❌ Introduce deployable application or database changes

**This PR does**:
- ✅ Document the evidence-mapping design model (not yet approved for implementation)
- ✅ Define fail-closed contract for assessment release gate
- ✅ Establish governance sequence (Steps 1–7) with approval gates
- ✅ Provide read-only staging audit queries for evidence-chain diagnosis
- ✅ Add credential-free local contract validation tests
- ✅ Support CI review; stakeholder approval remains a human governance decision

**This PR is a governance and design reference**, not an approved implementation or enforceable CI gate. It must be reviewed and explicitly approved before any remediation work (Steps 1–7) can proceed.

**Status**: ⏳ Awaiting explicit stakeholder approval of the question-to-provenance crosswalk methodology before proceeding to Step 1

---

## Governance Hold

This PR establishes a read-only contract only. No remediation action is authorized until both conditions are met:

1. CI is green.
2. A stakeholder explicitly approves the deterministic question-to-provenance crosswalk methodology.

Until then, do not create or run backfill SQL, reconcile the catalog, attach or validate citations, create RPCs, or apply migrations.

---

## Unverified Gaps (Require Credentialed Testing)

The following behavior is **defined in the contract but not yet verified** by this PR:

**Release Gate (Stage 5)**: ⏳ Test is skipped (requires credentialed API testing)
- Expected: Assessment endpoint returns zero questions when evidence chain is incomplete
- Verification needed: Run credentialed test against staging with partial vs. complete evidence
- Status: Deferred to staging audit after Steps 1–5 complete

**RLS Protection (Answer-Key Security)**: ⏳ Test is skipped (requires real Supabase anon/public key)
- Expected: RLS policy denies anonymous access to correct_answer and explanation columns
- Current test uses hardcoded JWT string (not a valid publishable key)
- Verification needed: Real staging credential testing with actual anon key
- Status: Deferred to staging security audit; not verified by this PR

**Contract Fulfillment (Evidence Stages 1–5)**: ✅ Defined by 6 read-only queries
- These queries document what database state should be when complete
- Queries are ready to run in staging to diagnose current gaps
- Actual fulfillment (backfill, reconciliation, validation) deferred pending approval

## Definition of Success (Post-Approval)

After stakeholder approves Steps 1–7 and remediation completes:
- [ ] All scenario_questions have non-null question_id values
- [ ] All question_id values link to exactly one approved question_provenance
- [ ] All approved provenance have citations to approved sources/chunks
- [ ] All citations have valid validation records (all flags true)
- [ ] All 21 active scenarios are represented in scenario_catalog
- [ ] Release gate query returns evidence-backed questions for all 21 scenarios
- [ ] RLS testing confirms answer keys are protected from anonymous access
- [ ] Jest suite passes (103 suites, 507 tests)
- [ ] Lint passes

---

## Rollback Plan

If evidence mapping breaks a scenario during remediation (Steps 1–7):
1. Revert the backfill commits for the affected scenario
2. Restore question_id = NULL state for those rows
3. Re-run Query 6 (evidence gap diagnosis) from supabase/contracts/evidence-mapping-contract.sql to confirm zero evidence-backed questions
4. No student impact (questions never rendered due to fail-closed gate)

---

## Related Documents

- `EVIDENCE-GATED-GENERATOR-APPLIED.md` — Prior evidence ingestion
- `NO-CRANK-HUMAN-PASSAGE-ATTESTATION.json` — Evidence attestation
- `PRODUCTION_READINESS_CHECKLIST.md` — Release gates
- `supabase/verification/03_gate4_readiness.sql` — Release gate query

