# R22 / LMF coverage remediation — design for review (NOT implemented)

**Status: proposal only.** No test, manifest, workflow or migration is changed by this document.
Base: PR #1128 head `f19ac872` on branch `docs/r22-lmf-coverage-remediation-plan`.
Security status unchanged: **R21 UNVERIFIED · R22 UNVERIFIED · R26 PARTIAL.**

Every behavioural claim below marked *validated* was reproduced in a throwaway PGlite session at
`f19ac872` (scripts in `/tmp`, nothing added to the repository).

---

## 1. Scope

1. Make the two new LMF policy tables **measured**, not merely declared: PGlite assertions for
   owner visibility, cross-user denial, expiry, anonymous access and client-write restrictions,
   with the privilege layer and the RLS layer tested separately.
2. Close the LMF execution gap so `tests/lmf-unified-runtime.test.js` and the twelve LMF security
   contracts run in a **required** job.

## 2. Out of scope (explicitly)

- The LMF release-evidence HOLD and its eight pending gates — untouched.
- `jest.config.js` `testPathIgnorePatterns` — **not weakened**. The exclusion is correct: Jest
  cannot execute `node:test` files. This design adds required execution elsewhere instead.
- Staging migration drift (`20261013190000_retire_external_certification_taxonomy.sql`) — a
  pre-existing, non-LMF discrepancy, tracked separately.
- Supabase infrastructure, credentials, grants in production, RLS policy text.
- Any claim that PGlite coverage equals Supabase/PostgREST verification.

---

## 3. Findings that constrain the design

| # | Fact | Consequence for the design |
| --- | --- | --- |
| F1 | The harness applies a **curated subset** of migrations (`REQUIRED_MIGRATIONS`), not all 109 | The three LMF migrations must be added explicitly, in dependency order |
| F2 | All three apply cleanly under the harness shim *(validated)* | No shim changes needed; `gen_random_uuid()` and `auth.users` FKs already satisfied |
| F3 | `authenticated` holds **SELECT only** on both tables `(validated)` | Write denials are **privilege** denials; RLS is a second, independent layer |
| F4 | RLS SELECT denial returns **0 rows**, privilege denial **raises** `permission denied for table` *(validated)* | Two different assertion shapes are required; conflating them hides a layer |
| F5 | `anon` has **no** SELECT grant → denial is a privilege error, not RLS *(validated)* | The anon test asserts the error text, not a row count |
| F6 | The events policy's session-join hides events whose parent session expired *(validated: 1 of 2 visible)* | Needs its own assertion with an expired-parent fixture |
| F7 | `now()` is the real clock; `check (expires_at > created_at)` is enforced *(validated)* | Expiry fixtures use relative intervals (`now() ± interval`), no time travel |
| F8 | 43 `create policy` statements but only **31 distinct** `(table, name)` pairs — 12 classroom policies are dropped and recreated | Coverage must be reported both ways; see §7 |
| F9 | `lmf-unified-runtime.test.js` is in **no** CI list and is excluded from Jest | The single orphan this design must close |
| F10 | Required checks are only `unit-tests`, `Run ESLint`, `Jest (jsdom)`, `Playwright E2E`, `build-and-test (22)/(24)` | Neither LMF workflow gates merges today |

---

## 4. Proposed test matrix

Fixtures (added to the harness, not to any migration):

| Fixture | Owner | `expires_at` | Purpose |
| --- | --- | --- | --- |
| `LMF_SESSION_ACTIVE` | USER_A | `now() + 1 hour` | visible positive case |
| `LMF_SESSION_EXPIRED` | USER_A | `now() - 1 day`, `created_at = now() - 2 days` | expiry predicate, same owner |
| `LMF_SESSION_OTHER` | USER_B | `now() + 1 hour` | cross-user case |
| `LMF_EVENT_ACTIVE` | — | parent = ACTIVE | event visibility |
| `LMF_EVENT_EXPIRED` | — | parent = EXPIRED | policy's session-join clause |

All seed rows are written as `service_role` (BYPASSRLS), mirroring the only production write path,
rather than as the harness's superuser connection.

| ID | Assertion | Role | Expectation | Attributed table |
| --- | --- | --- | --- | --- |
| S1 | owner reads own unexpired session | authenticated A | 1 row | `lmf_reference_sessions` |
| S2 | owner does **not** see the expired session | authenticated A | 0 rows for that id | `lmf_reference_sessions` |
| S3 | other user sees no sessions | authenticated B | 0 rows | `lmf_reference_sessions` |
| S4 | anon SELECT | anon | rejected `/permission denied for table/` | `lmf_reference_sessions` |
| S5 | authenticated INSERT | authenticated A | rejected `/permission denied for table/` | `lmf_reference_sessions` |
| S6 | authenticated UPDATE | authenticated A | rejected `/permission denied for table/` | `lmf_reference_sessions` |
| S7 | authenticated DELETE | authenticated A | rejected `/permission denied for table/` | `lmf_reference_sessions` |
| E1 | owner reads own event | authenticated A | 1 row | `lmf_reference_events` |
| E2 | other user sees no events | authenticated B | 0 rows | `lmf_reference_events` |
| E3 | **expired parent hides its events** | authenticated A | 1 row (not 2) | `lmf_reference_events` |
| E4 | authenticated INSERT | authenticated A | rejected `/permission denied for table/` | `lmf_reference_events` |
| E5 | authenticated UPDATE / DELETE | authenticated A | rejected | `lmf_reference_events` |
| E6 | anon SELECT | anon | rejected `/permission denied for table/` | `lmf_reference_events` |
| X1 | authenticated cannot EXECUTE the append function | authenticated A | rejected `/permission denied for schema lmf_private/` | `lmf_reference_events` |

That is 14 new assertions, all attributed to the two new tables via the harness's `tableOf()` rule
(the first `public.<table>` token in the SQL), so the guard measures them rather than trusting the
manifest.

## 5. Positive controls (so "deny everything" cannot pass)

A suite made only of denials is satisfied by a broken schema. These must be present:

| ID | Assertion | Role | Expectation |
| --- | --- | --- | --- |
| P1 | service_role can insert a session and an event | service_role | 1 row inserted |
| P2 | append with the correct `expected_sequence` and `previous_hash` | service_role | accepted (returns uuid) *(validated)* |
| P3 | append with a wrong `expected_sequence` | service_role | rejected `/Stale or broken reference evidence chain/` *(validated)* |
| P4 | append to an expired session | service_role | rejected `/Session missing, expired, or owner mismatch/` *(validated)* |
| P5 | retention purge removes the expired session | service_role | 1 row removed *(validated)* |
| P6 | owner visibility (S1/E1) | authenticated A | 1 row each |

P2 is the important one: it proves the atomic append path is reachable at all, so P3/P4 are not
passing because the function is simply unreachable.

## 6. Privilege denials vs RLS denials — separated on purpose

F3/F4/F5 mean a naive write test proves only the privilege layer. If a future migration re-granted
`INSERT` to `authenticated`, every existing denial test would still pass and the hole would ship.

The design therefore adds a **transient probe role** created and dropped inside the harness run:

```sql
create role rls_probe nologin;
grant usage on schema public to rls_probe;
grant select, insert, update, delete on public.lmf_reference_sessions to rls_probe;
grant select, insert, update, delete on public.lmf_reference_events   to rls_probe;
```

| ID | Assertion | Role | Expectation | Proves |
| --- | --- | --- | --- | --- |
| R1 | INSERT session as a role that **holds** the privilege | rls_probe | rejected `/violates row-level security policy for table "lmf_reference_sessions"/` *(validated)* | RLS layer independent of privilege |
| R2 | same for events | rls_probe | rejected, same message shape | RLS layer |
| R3 | SELECT as rls_probe with A's claims | rls_probe | 1 row | policy predicate works for a non-API role |

`rls_probe` is created and `drop role`d within the run, so no state escapes the harness. R1/R2 are
attributed to their tables like any other assertion. Together with S5/E4 this gives defence-in-depth
evidence: privilege-denied for `authenticated`, RLS-denied for a privileged role.

## 7. Counting: statements vs distinct effective policies

The guard's denominator is `create policy` **statements**, which over-counts because
`20260924052757_optimize_classroom_api_rls.sql` drops and recreates twelve policies with
`(select auth.uid())`:

| Measure | Value |
| --- | --- |
| `create policy` statements | **43** |
| `drop policy` statements | **28** |
| Distinct `(table, policy name)` pairs — the ceiling on simultaneously effective policies | **31** |
| Policy names defined twice (all classroom) | **12** |
| Policy-bearing tables | **15** |

Per table (statements / distinct): assignments 4/2, classes 8/4, completions 4/2, enrollments 4/2,
replays 4/2, syllabi 4/4, syllabus_scenarios 4/4, telemetry_events 4/4, the four singleton tables
1/1 each, and both LMF tables 1/1.

So "43 policy statements" must not be read as "43 effective policies". Coverage reported both ways:

| | Distinct (honest denominator) | Statements (guard's output) |
| --- | --- | --- |
| Today | 15/31 = **48%** | 21/43 = **49%** |
| After this change | 17/31 = **55%** | 23/43 = **53%** |

Proposal (non-gating): have the guard also print the distinct count so the number cannot be
overstated in prose. This changes **reporting only** — the pass/fail rule is per-table, so no
coverage claim becomes weaker or stronger.

The twelve probationary planning tables (assignments, replays, completions, profiles,
telemetry_events, diagnostic_data_domains, external_data_resources,
external_resource_domain_links) stay `planned`; this design does not touch them.

## 8. PGlite limitations (to be documented in the evidence file)

These cannot be proven by this harness, and the evidence doc must say so:

1. **No PostgREST.** `SET ROLE authenticated` approximates an API request. The real privilege
   evaluation path (PostgREST's role switch, schema exposure, `db-schemas`) is not exercised.
2. **`auth.uid()` is shimmed** from `request.jwt.claims`. JWT issuance, signature verification and
   claim trust are untested here.
3. **`service_role` BYPASSRLS is asserted by the shim,** not observed from the project. A
   mis-scoped production key would not be caught.
4. **No concurrency.** Single connection; `for update` + `skip locked` serialization in
   `append_reference_event` and the retention worker's `for update skip locked` are **not**
   verified under contention. Two real connections are required for that.

---

## 9. Exact file-change plan

### 9.1 `tests/r22/pglite-rls-harness.mjs` (modified — the only test logic)

| Location | Change |
| --- | --- |
| `REQUIRED_MIGRATIONS` (array ending line 51) | append, in this order: `20261024212822_lmf_reference_evidence_access.sql`, `20261024213613_lmf_atomic_reference_append.sql`, `20261024221008_lmf_reference_retention_guard.sql` |
| fixture block (near line 121, after `USER_A`/`USER_B`) | add `LMF_SESSION_ACTIVE`, `LMF_SESSION_EXPIRED`, `LMF_SESSION_OTHER`, `LMF_EVENT_*` ids and the shared `MODEL_REF` / 64-hex hash constants |
| `SEED_SQL` (block starting line 128) | append the LMF seed: two sessions for A (one expired, `created_at` set earlier so `check (expires_at > created_at)` holds), one for B, one event per session |
| before the `// Migration compatibility sweep` block (line 561) | new section `// R22 phase 5 — LMF reference evidence`, containing S1–S7, E1–E6, X1, P1–P6, R1–R3 in that order, plus `create role rls_probe` / `drop role rls_probe` in a `try/finally` |
| header comment (lines 1–31) | add the LMF caveats from §8 (no concurrency, shimmed `auth.uid()`, asserted BYPASSRLS) |

No helper changes: the existing `expectRows`, `expectRejected`, `expectAffected`, `asRole` and
`record` cover every case in §4–§6. `tableOf()` attribution works because every assertion names
`public.lmf_reference_sessions` or `public.lmf_reference_events` as its first `public.` token.

### 9.2 `tests/r22/rls-coverage.json` (modified — 2 entries + a note)

```json
"policyTablesTested": [
  "classes",
  "enrollments",
  "lmf_reference_events",
  "lmf_reference_sessions",
  "scenario_catalog",
  "syllabi",
  "syllabus_scenarios"
]
```

`$comment`/`$phaseNote` gain one sentence: the statement count over-counts distinct policies because
twelve classroom policies are dropped and recreated, so the manifest tracks tables, not a policy
percentage.

`phases`, `denyAllExpected` and `knownGaps` are **unchanged**: adding a `phase 5` entry would
satisfy the guard by scheduling rather than measuring, which is exactly the false-claim pattern the
guard exists to reject. No `denyAllExpected` change is needed because both new tables are
policy-bearing; no `knownGaps` change because both have RLS enabled.

### 9.3 `scripts/run-lmf-node-contracts.mjs` (new, ~60 lines)

Single source of truth for "which LMF file runs where", plus the completeness tripwire:

```
NODE_NATIVE   = [13 files]            // 12 from lmf-security-contracts.yml + lmf-unified-runtime.test.js
JEST_VISIBLE  = [lmf-foundation.test.js, lmf-runtime-coverage.test.js,
                 lmf-reference-bridge.spec.js, lmf-reference-evidence.spec.js]
present       = tests/lmf-*.test.js + tests/lmf-*.spec.js   (19 files today)
fail if present − (NODE_NATIVE ∪ JEST_VISIBLE) ≠ ∅           // names the orphaned file
fail if (NODE_NATIVE ∪ JEST_VISIBLE) − present ≠ ∅           // names the stale entry
then: spawnSync(node, ['--test', ...NODE_NATIVE], { stdio: 'inherit' })
```

The script fails loudly with the offending filenames, so a new LMF test cannot silently land unrun —
the exact defect this design exists to fix. `lmf-release-gates.test.js` and
`lmf-robustness-catalog.test.js` stay out of `NODE_NATIVE` on purpose: they belong to the release
gates, whose HOLD this change must not touch. They remain classified (as release-gate files) so the
completeness check stays meaningful; the script asserts their presence but does not run them.

### 9.4 `.github/workflows/unit-tests.yml` (modified — one step)

Inserted after the existing guard self-test step (line 52), before `Validate scenarios`:

```yaml
      # LMF contracts that cannot run under Jest (node:test) — see
      # scripts/run-lmf-node-contracts.mjs. The script also fails if an LMF test
      # file is neither executed here nor visible to Jest, so a new contract
      # cannot land unrun. Release-gate tests stay in their own HOLD workflow.
      - name: Run LMF node-native contracts
        run: node scripts/run-lmf-node-contracts.mjs
```

### 9.5 `docs/security/R22-PGLITE-RLS-EVIDENCE.md` (modified)

Record: the two tables, the 14 assertions, the privilege-vs-RLS separation (R1/R2), the new counts
(7/15 tables, 23/43 statements, 17/31 distinct), and the §8 limitation list.

### 9.6 Optional, not required

- `package.json` → `"test:lmf:contracts": "node scripts/run-lmf-node-contracts.mjs"` for local
  parity with CI. Adds one file to the diff; no dependency change.
- `.github/workflows/lmf-security-contracts.yml` → replace the inline 12-file list with a call to
  the same script, removing the duplicate list. Deferred so this PR stays minimal; the script's
  completeness check makes the duplication *detectable* meanwhile.

### 9.7 Diff size

5 files: 1 test harness (+~120 lines), 1 manifest (+2 entries), 1 new script (~60), 1 workflow
(+6), 1 doc (+~30). No migration, no policy, no grant, no jest exclusion, no release-gate change.

5. **Real clock.** Expiry is tested with ±1 hour/day intervals; a policy using a longer horizon
   would not be caught.
6. **Default-privilege mirroring is an assumption** about Supabase project settings
   (`alter default privileges … grant all` in the shim), not a measurement.
7. **`lmf_private` functions are tested only for reachability and chain rules,** not for
   `search_path` hardening under adversarial schema injection.


---

## 10. CI integration design

### 10.1 Why the required `unit-tests` job is the right host

`.github/workflows/unit-tests.yml` defines the job whose check name `unit-tests` is one of the six
contexts required on `main`. It already owns the R22 harness, the coverage guard and its self-test,
so LMF contracts belong beside them rather than in a seventh workflow. It runs `npm ci` already, so
the marginal cost is the test execution alone — **31 tests in 115 ms** over the full 13-file
invocation *(validated locally at `f19ac872`)*.

### 10.2 Options considered

| Option | Change | Drift protection | Verdict |
| --- | --- | --- | --- |
| **A. Inline list** | paste a 13-file `node --test` command into `unit-tests.yml` | none — a new test file is silently unrun again | rejects the root cause |
| **B. Script + completeness check** (recommended) | `scripts/run-lmf-node-contracts.mjs` + 1 workflow step | the script fails when an LMF file is in neither list | fixes the cause and prevents recurrence |
| **C. Require `LMF Security Contracts`** | add the workflow to branch protection | still leaves `lmf-unified-runtime.test.js` orphaned; edits protection config | larger blast radius, incomplete |

Option C is rejected for two reasons: it does not fix the orphan, and `branch-protection.yml`
already carries a `expected` list that has drifted from the live six contexts (`unit-tests`,
`build-and-test (22)`, `build-and-test (24)`, `Run ESLint`, `api-smoke` versus the actual set, which
includes `Jest (jsdom)` and `Playwright E2E`). Adjusting protection is a separate governance change
and outside "smallest change to the required `unit-tests` workflow".

### 10.3 What stays untouched

- `jest.config.js` exclusions — unchanged; they are correct and the design works with them.
- `lmf-release-evidence.yml` and its `Require validated release evidence` step — unchanged, HOLD
  intact, eight pending gates untouched.
- `lmf-restored-supabase-access.yml` — unchanged (its failure needs credentials, not this work).
- `scripts/run-tests.js` / root `npm test` — unchanged; Jest discovery is unaffected.

### 10.4 Resulting execution map (19 files)

| Host | Files | Required? |
| --- | --- | --- |
| `unit-tests` → new step (13) | 12 security contracts + `lmf-unified-runtime.test.js` | **yes** |
| `unit-tests` / `Jest (jsdom)` / `Run full test suite` (4) | `lmf-foundation`, `lmf-runtime-coverage`, 2 `.spec.js` | **yes** |
| `LMF Release Evidence Gate` (2) | `lmf-release-gates`, `lmf-robustness-catalog` | no (HOLD) |
| **nowhere** | — | — |

---

## 11. Verification plan (what must be green before this is proposed as implemented)

```bash
npm run test:r22                                  # 58 -> 81 assertions, 0 failures
npm run verify:rls-coverage                       # PASS: 7/15 tables, 23/43 statements (53%),
                                                  #       17/31 distinct (55%), 0 untracked
npm run verify:rls-coverage:self-test             # unchanged PASS, 4 mutation cases
node scripts/run-lmf-node-contracts.mjs           # 31 tests, 0 failures
node -e "..."                                     # negative control: remove one manifest entry
                                                  # -> guard exits 1 (still rejects overstatement)
npm test                                          # unchanged: 523 suites, no new failures
npx eslint tests/r22 scripts/run-lmf-node-contracts.mjs --ext .js,.mjs
```

Mandatory negative controls before claiming success:

1. With the manifest entries **added** and the harness assertions **removed**, the guard still fails
   `overstatement` — proving the manifest cannot substitute for evidence.
2. With one assertion deliberately broken, `npm run test:r22` fails and the guard exits 3.
3. Delete one file from `NODE_NATIVE`, add a dummy `tests/lmf-orphan.test.js`, and confirm the
   script fails naming both files.

---

## 12. Risks, rollback, sequencing

| Risk | Mitigation |
| --- | --- |
| Adding 3 migrations perturbs existing assertions | they only add `lmf_*` tables and the `lmf_private` schema; the 58 existing assertions must be re-run and stay green before anything else |
| `rls_probe` role leaks state between assertions | created and dropped inside one `try/finally`; the DB is in-memory per run |
| Positive controls inflate "coverage" | the evidence doc states that table coverage includes control paths; the guard's per-table rule is unaffected |
| New LMF test file added later, unclassified | the script fails and names it — the intended tripwire |
| Workflow step slows the required job | measured 115 ms; the job already pays for `npm ci` |
| Someone "fixes" the guard failure by adding a `phase 5` entry | §9.2 forbids it; the plan tests for measurement, not scheduling |

Rollback is `git revert` of 4 code files (harness, manifest, script, workflow) plus the doc — no
data, no policy, no protection config, no infrastructure.

Sequencing: harness + assertions → `test:r22` green → manifest → guard PASS → script → workflow →
docs → negative controls → full local sweep → CI on PR #1128 (no push from this branch until
reviewed).

---

## 13. Decision requested

1. Approve **Option B** for CI (script + one required step) versus Option A.
2. Approve **measurement** (tests + `policyTablesTested`) versus scheduling the two tables in a
   `phase 5` entry — the recommendation is measurement, per your instruction.
3. Confirm the two release-gate test files may stay in the non-required release workflow, so this
   change does not touch the HOLD surface.
4. Confirm whether the optional items in §9.6 belong in the same PR or a follow-up.

