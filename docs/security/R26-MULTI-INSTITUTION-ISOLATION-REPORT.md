# R26 — Verified Multi-Institution Isolation

**Status: PARTIAL** — authorization behaviour verified at runtime for both endpoints;
infrastructure-level enforcement (real JWT signatures, real database, RLS) remains **BLOCKED**.

| Field | Value |
| --- | --- |
| Repository | `/home/rod/projects/car-diagnosis-simulator` |
| Baseline | `main` @ `b3ab4a2d10ce6184114b255966b4ebfc19c466b7` (= `origin/main` at start) |
| Work branch | `test/r26-multi-institution-isolation` (worktree `/home/rod/r26-isolation`) |
| Readiness branch | `feat/instructor-diagnostic-readiness-endpoint` @ `a0d0f3c0` (untouched; detached worktree `/home/rod/r26-readiness`) |
| Node | v24.22.2 |
| Runtime tests | institution reporting 10/10, diagnostic readiness 8/8 |
| Jest | 514 suites / 3007 tests passed, exit 0 |
| Migrations / grading / eligibility changes | none |

## 1. Executive summary

Both endpoints behave correctly for tenant isolation **when exercised**, not merely when
grep-inspected. The verification runs the real route handlers — imported unmodified from the
worktrees under test — over real HTTP, with only the identity provider and PostgREST surfaces
stubbed locally.

What is now established with reproducible evidence:

- Institution reporting: anonymous and invalid tokens get 401; authenticated non-administrators
  get 403; an administrator of A cannot read B; an **inactive** membership at A does not
  authorize A; a learner enrolled at both institutions gains nothing; `activity` is `null` at
  report and class level; and the handler **issued zero `attempts` queries** in all ten scenarios.
- Diagnostic readiness: 401/403 as expected; on the committed schema it fails closed with
  `503 attempt_attribution_unavailable`; with a hypothetical attribution column it scopes strictly
  to owned classes, excluding a foreign-institution attempt and a null-attributed historical attempt.

What remains **unverified** and must not be assumed:

- Real JWT signature/expiry validation (the identity provider is a local stub).
- Real Postgres behaviour, including RLS policies (no credentials, no Docker).
- Whether service-role access combined with the routes' own filters is sufficient at the database
  layer. Service-role bypasses RLS, so tenant restriction is enforced by the routes, not by RLS.

A methodological note worth keeping: the first harness run reported "8/10 passed" while six
denials were passing **for the wrong reason** — a stub bug (`Number(null) → 0`) made every query
return zero rows, so 403s appeared without exercising the real filters. Fixing the stub moved the
result to 10/10 *with authorized access succeeding*, which is the only state in which the denials
carry information. This is direct evidence for the milestone's premise that source-pattern
assertions are not authorization evidence.

## 2. Repository baseline

```
pwd                              /home/rod/projects/car-diagnosis-simulator
git status --porcelain=v1        (empty — clean tree)
git branch --show-current        main
git rev-parse HEAD               b3ab4a2d10ce6184114b255966b4ebfc19c466b7
git rev-parse origin/main        b3ab4a2d10ce6184114b255966b4ebfc19c466b7
git rev-parse feat/…readiness…   a0d0f3c0e2146d1eaddc0d7fd19a9456ad027713
```

Branches were not rewritten. The readiness branch was mounted read-only at a detached worktree.
`node_modules` was supplied to both worktrees by symlink (untracked, gitignored) because worktrees
do not share it; no production file was altered.

## 3. Authorization architecture

**Institution reporting** (`GET /api/institution/admin/report`, `handleInstitutionAdminReport`):

1. `extractBearerToken(c.req.header('authorization'))` → 401 if absent.
2. `verifySupabaseToken(token, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` → `supabase.auth.getUser(token)`,
   i.e. one HTTPS call to `<url>/auth/v1/user` → 401 on error.
3. `loadActiveReportMembership` queries `institution_memberships` filtered by
   `school_code` **and** `user_id` **and** `status = 'active'`, then requires role ∈
   `{institution_admin, institution_owner}` → 403 otherwise.
4. Data queries use a **service-role** client (`createServiceClient`) — RLS is bypassed, so tenant
   restriction rests entirely on the `.eq('institution_school_code', schoolCode)` and
   `class_id`/`user_id` filters in the route.
5. Attempts are **not queried at all**; `activity` is hard `null`.

**Diagnostic readiness** (branch `a0d0f3c0`, `GET /api/instructor/diagnostic-readiness`):

1. Same token extraction and verification.
2. `resolveTrustedRole(user, supabase)` prefers `user.app_metadata.role`, falling back to
   `profiles.role`; `isInstructorRole` gates → 403.
3. Scope: `classes.owner_id = caller` → class ids. No owned classes ⇒ empty result.
4. `hasClassAttribution` probes `attempts.class_id`; absent ⇒ `503 attempt_attribution_unavailable`.
5. When present: `attempts.class_id IN owned` **and** `class_id IS NOT NULL` → answers →
   `scenario_questions.ase_area` → per-area aggregates.
6. Enrollments are never consulted; no answer text, `correct_answer`, `student_answer` or
   `is_correct` value is returned — only counts.

Error responses are generic (`{"error":"Authentication required"}`,
`{"error":"Institution administrator access required for institution reporting"}`,
`{"error":"Instructor access required"}`) and carry no tenant identifiers, row counts, or
dependency names.

## 4. Institution-reporting findings

Runtime matrix (10/10 PASS). Every row exercised the real handler via HTTP.

| # | Scenario | Expected | Observed | Attempts queried | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | No token | 401 | 401 | 0 | PASS |
| 2 | Invalid token | 401 | 401 | 0 | PASS |
| 3 | Authenticated student, no institution role | 403 | 403 | 0 | PASS |
| 4 | Instructor (not an administrator) | 403 | 403 | 0 | PASS |
| 5 | Cross-institution learner requests A | 403 | 403 | 0 | PASS |
| 6 | **Inactive** membership at A | 403 | 403 | 0 | PASS |
| 7 | Administrator A requests B | 403 | 403 | 0 | PASS |
| 8 | Administrator A reads A | 200 | 200 | 0 | PASS |
| 9 | Administrator B reads B | 200 | 200 | 0 | PASS |
| 10 | Missing membership dependency | 500 | 500 | 0 | PASS |

Authorized response for A (trimmed):

```json
{
  "schoolCode": "AAA111",
  "uniqueStudents": 2,
  "activity": null,
  "classSummaries": [
    { "classId": "c-a1", "name": "A1 Brakes", "studentCount": 2, "activity": null },
    { "classId": "c-a2", "name": "A2 Electrical", "studentCount": 0, "activity": null }
  ]
}
```

Findings:

- **Tenant scoping works.** B's report (`BBB222`) contains no A class; A's report contains no B
  class. Fixture `c-b1` ("B1 Engine") never appears in A's payload.
- **The role check is real, not incidental.** Scenario 6 matches the user, the institution *and*
  role `institution_admin` — only `status='active'` excludes it. Scenario 5 matches an active
  membership with role `member`, excluded by the role allow-list.
- **No existence oracle.** Requesting B as A's administrator returns byte-identical JSON to a
  request from a user with no membership at all, so the endpoint does not confirm whether another
  institution exists.
- **Attempts are structurally absent.** `attemptsQueried` is 0 across all ten scenarios, including
  the two authorized ones. Withheld metrics are `null`, never `0`: the payload contains no
  `"attempts":0`, `"completedAttempts":0`, `"completionRate":0` or `"averageScore":0`.
- **Verifiable data preserved.** `uniqueStudents`, per-class `studentCount`, program/cohort totals
  and membership counts remain, and match the fixture exactly.

## 5. Diagnostic-readiness findings

Runtime matrix (8/8 PASS) against `/home/rod/r26-readiness/worker/routes/diagnostic-readiness.js`
@ `a0d0f3c0`. The branch was not merged or cherry-picked.

| # | Scenario | Expected | Observed | Status |
| --- | --- | --- | --- | --- |
| 1 | No token | 401 | 401 | PASS |
| 2 | Invalid token | 401 | 401 | PASS |
| 3 | Student token | 403 | 403 | PASS |
| 4 | Instructor, committed schema (no `attempts.class_id`) | 503 `attempt_attribution_unavailable` | 503, same reason | PASS |
| 5 | Instructor owning no classes | 200 empty | 200, `rows: []` | PASS |
| 6 | Instructor A, attributed schema | owned classes only | `classIds:["c-a1","c-a2"]`, `attemptsScoped:2` | PASS |
| 7 | Instructor B, attributed schema | B only | `classIds:["c-b1"]`, `attemptsScoped:1` | PASS |
| 8 | Missing `scenario_questions` dependency | 503 `question_taxonomy_unavailable` | 503, same reason | PASS |

Fail-closed body on the committed schema:

```json
{ "error": "diagnostic_readiness_unavailable", "reason": "attempt_attribution_unavailable", "rows": [] }
```

Cross-tenant and attribution evidence (scenario 6). Enrolment-based attribution would have
included `att-null` (owned by a learner enrolled in A's class) and produced `attemptsScoped: 3`;
the observed value is **2**, reachable only by filtering on `class_id`:

| Attempt | Owner | `class_id` | Included? | Why |
| --- | --- | --- | --- | --- |
| `att-a1` | learnerBoth | `c-a1` (A, owned) | yes | owned class |
| `att-a2` | learnerA | `c-a2` (A, owned) | yes | owned class |
| `att-b1` | learnerB | `c-b1` (B) | **no** | other institution's class |
| `att-null` | learnerBoth | `null` | **no** | unattributed historical attempt |

Aggregates corroborate exclusion: `brakes` = 1 attempted / 1 correct (a leak from `att-null`
would make it 2/2) and `electrical` = 1/0 (`att-b1` would make it 2/1).

The payload scan found no `u-learner*`, `att-*`, `is_correct`, `question_text` or `student_answer`
strings — aggregates only.

## 6. Harness fidelity and how to reproduce

The harness fakes as little as possible. Its fidelity boundary:

| Surface | Real or stubbed |
| --- | --- |
| Route handler code, authorization branches, query filters | **real** (imported from the worktree under test) |
| `extractBearerToken` | **real** |
| `verifySupabaseToken` → HTTP `GET /auth/v1/user` | call **real**, responder stubbed |
| `resolveTrustedRole` (`app_metadata` → `profiles.role`) | **real** |
| `institution_memberships` / `classes` / `enrollments` / `attempts` / `attempt_answers` queries | **real**, served by a PostgREST-compatible stub |
| Postgres, RLS, JWT signing/verification crypto | **absent** |

Fixtures: institutions A (`AAA111`) and B (`BBB222`); administrators and instructors per
institution; an instructor owning no classes; a single-attendance student; learners enrolled in A
only, B only, and both; `c-b1` and `att-null` exist specifically to be excluded. The `attributed`
schema variant is a harness fixture only — it is not a migration and makes no claim about the
real schema.

```
node tests/r26/isolation-matrix.mjs --suite institution
node tests/r26/isolation-matrix.mjs --suite readiness \
  --route /home/rod/r26-readiness/worker/routes/diagnostic-readiness.js
```

`tests/r26-multi-institution-isolation.test.js` wraps the institution suite for CI and asserts
that the readiness suite **refuses to run** without an explicit isolated route, so it cannot
silently degrade into a source-code check.

## 7. Cross-tenant exposure findings and requirement classification

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R1 | Institution report requires authentication | **PASS** | 401 for absent/invalid token, runtime |
| R2 | Institution report requires admin/owner role | **PASS** | 403 for student, instructor, active non-admin membership |
| R3 | Report scoped to requested institution only | **PASS** | A payload contains no B class; B payload contains no A class |
| R4 | Inactive membership does not authorize | **PASS** | 403 with otherwise-matching user/school/role |
| R5 | Cross-institution learner gains no access | **PASS** | 403; enrolment is not authorization |
| R6 | Attempt-derived activity withheld as `null` | **PASS** | `activity: null` at report and class level |
| R7 | Report never queries attempts | **PASS** | `attemptsQueried: 0` in all 10 runtime scenarios |
| R8 | Verifiable counts preserved | **PASS** | `uniqueStudents: 2`, per-class `studentCount` match fixture |
| R9 | Missing dependency fails closed | **PASS** | 500 with no report data |
| R10 | Error responses leak nothing | **PASS** | Identical generic body for missing vs other-tenant membership |
| R11 | Readiness requires authentication | **PASS** | 401 runtime |
| R12 | Readiness requires instructor role | **PASS** | 403 for student |
| R13 | Readiness scoped to owned classes | **PASS** | A: `["c-a1","c-a2"]`; B: `["c-b1"]` |
| R14 | Readiness refuses without class attribution | **PASS** | 503 `attempt_attribution_unavailable` |
| R15 | No enrolment-derived fallback | **PASS** | `attemptsScoped: 2`; enrolment logic would yield 3 |
| R16 | Foreign-attributed attempts excluded | **PASS** | `att-b1` absent from A's scope and aggregates |
| R17 | Null-attributed attempts excluded | **PASS** | `att-null` absent; `brakes` stays 1/1 |
| R18 | No answer keys, stems or per-student rows | **PASS** | Payload scan for `is_correct`, `correct_answer`, `student_answer`, `question_text` |
| R19 | No fabricated zero for unavailable metrics | **PASS** | `null`/503, never `0` |
| R20 | Readiness fails closed on missing dependency | **PASS** | 503 `question_taxonomy_unavailable` |
| R21 | Real JWT signature/expiry enforcement | **BLOCKED** | identity provider stubbed; no signing keys available |
| R22 | Real Postgres/RLS enforcement | **BLOCKED** | no credentials, no Docker; service-role bypasses RLS |
| R23 | Attributed schema in the real database | **NOT APPLICABLE** | `attempts.class_id` does not exist; simulated only |

No **FAIL** was observed. Two items are **BLOCKED** for environmental rather than design reasons,
which is why this report is PARTIAL rather than PASS.

## 8. Fail-closed behaviour

| Endpoint | Condition | Response | Data disclosed |
| --- | --- | --- | --- |
| Institution report | no/invalid token | 401 `Authentication required` | none |
| Institution report | authenticated, not admin/owner | 403 `Institution administrator access required for institution reporting` | none |
| Institution report | membership query error | 500 `Unable to authorize institution reporting` | none |
| Institution report | any success | 200, `activity: null` | classes, enrolments, counts only |
| Readiness | no/invalid token | 401 `Authentication required` | none |
| Readiness | authenticated, not instructor | 403 `Instructor access required` | none |
| Readiness | `attempts.class_id` absent | 503 `attempt_attribution_unavailable`, `rows: []` | none |
| Readiness | readiness source error | 503 `attempts_unavailable` / `attempt_answers_unavailable` / `question_taxonomy_unavailable` | none |

Every failure path returns a stable error envelope with no partial payload, so a degraded
dependency cannot be mistaken for "no activity".

## 9. Product-visible limitations

1. **Institution activity metrics are unavailable** by design. Administrators see
   `Attempt records: Unavailable`, `Completion rate: Unavailable`, `Average score: Unavailable`
   (portal change shipped in PR #1146). Attempt-derived reporting returns only with class attribution.
2. **Readiness reporting returns 503** on the committed schema; the instructor analytics panel
   renders "diagnostic readiness data unavailable".
3. **Minor label defect on the readiness branch:** `humanize('brakes')` yields `"BRAKES"` rather
   than `"Brakes"`, because the helper upper-cases every character. Cosmetic and user-visible in the
   diagnostic-area column; not fixed here because production logic is out of scope for R26.
4. **Inconsistent shape for an instructor with no classes:** 200 with `rows: []` on the committed
   schema, whereas an instructor *with* classes receives 503. No data is exposed either way, but a
   client cannot distinguish "nothing to report" from "reporting unavailable" by status alone.
   Worth aligning when attribution lands.
5. **`classSummaries[].studentCount` may be `0`** for a class with no enrolments. That is a
   verifiable roster fact, not a withheld metric, and is intentionally preserved.

## 10. Remaining risks and blockers

| Risk | Severity | Note |
| --- | --- | --- |
| RLS not verified; service-role bypasses it | **High** | Tenant restriction lives in route filters. Any future route reusing the service client without `.eq(school_code)` would leak. R21/R22 (BLOCKED) |
| Real JWT validation unverified | Medium | Stubbed IdP accepts any token in our map; signature/expiry behaviour is Supabase's, not exercised here |
| No class-attributed attempts in the schema | Medium | Both endpoints are correct but degraded; restoration needs a write-path change |
| Diagnostic readiness is unmerged | Medium | `a0d0f3c0` exists only on the feature branch; `main` has no readiness route |
| Attributed-schema behaviour simulated | Low | Proves filter logic, not production behaviour |
| Staging smoke flakiness (separate) | Low | Unrelated to R26; intermittent teacher-session failures |

## 11. Recommendations

1. **Deploy-safety.** Institution reporting is safe to deploy as it stands: it is on `main`, it
   fails closed, and its tenant scoping is now behaviourally verified. Diagnostic readiness is
   **not** deployable yet — it is unmerged, and it must land only with the 503 behaviour intact.
2. **Do not treat R26 as complete.** R21/R22 require an environment with real Postgres and a
   signing identity. The correct next step is a disposable Supabase/Postgres instance where a
   forged token and a cross-tenant query can be attempted for real.
3. **Independent defence in depth.** Because the routes use service-role, consider (a) a lint/CI
   rule requiring an explicit tenant filter in any query against `classes`/`enrollments`, and
   (b) RLS policies that still constrain the anon/authenticated roles for the same tables.
4. **Attribution design.** Record class context at attempt creation, verified against membership
   at that moment; never retroactively assign historical attempts. Until then, keep `activity`
   `null` and the readiness 503 — do not restore figures by re-introducing user-id aggregation.
5. **Track the cosmetic defect** in §9.3 and the status-code inconsistency in §9.4 as follow-ups.

## 12. Exact evidence commands and results

Environment: Node v24.22.2, worktree `/home/rod/r26-isolation` @ `b3ab4a2d`, no `--forceExit`,
no `|| true`, no output filtering that hides exit codes.

| Command | Exit | Result |
| --- | --- | --- |
| `node tests/r26/isolation-matrix.mjs --suite institution` | 0 | 10/10 scenarios |
| `node tests/r26/isolation-matrix.mjs --suite readiness --route /home/rod/r26-readiness/worker/routes/diagnostic-readiness.js` | 0 | 8/8 scenarios |
| `npx --no-install jest tests/institution-reporting.test.js --runInBand` | 0 | 1 suite, 10 tests |
| `npx --no-install jest tests/r26-multi-institution-isolation.test.js --runInBand` | 0 | 1 suite, 2 tests |
| `npm run validate:production-api-route-inventory` | 0 | PASS, 0 unregistered gaps |
| `npm run validate:harness-history` | 0 | PASS, 24 rows |
| `npx --no-install jest --runInBand` | 0 | 514 suites / 3007 tests passed, 46 pre-existing skips |
| `npx --no-install eslint tests/r26/*.mjs tests/r26-multi-institution-isolation.test.js` | 0 | no findings |
| `git diff --check` | 0 | no whitespace errors |

Ancillary observations from the run log: the stub recorded `attemptsQueried: 0` for all ten
institution scenarios, and the readiness harness emitted `Diagnostic readiness refused: attempts
carry no trusted class attribution` — the route's own console evidence of the fail-closed branch.

### Blocked verification (explicit)

- **Real JWT verification** — needs a signing key or live IdP; not available without credentials.
- **Real Postgres/RLS** — no Docker (`rod` not in the `docker` group) and no sudo password;
  no staging credentials of our own. No privilege escalation was attempted.
- **Real Supabase PostgREST semantics** — column typing, RLS, and function/`RPC` behaviour are
  reproduced only approximately by the stub.
