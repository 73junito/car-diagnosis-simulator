# Disposable Supabase verification environment — infrastructure specification

**Status: specification only.** Nothing is provisioned. No credentials exist. No
infrastructure change is authorised by this document.

| Field | Value |
| --- | --- |
| Base commit | `a681ee6b6704d73f54befc9f1c1da5eb9dde151f` (`main`) |
| Scope | design for one throwaway Supabase project serving R21, R22 and R26 |
| Security status after execution | unchanged until the acceptance criteria in §10 are met |
| Current status | R21 **UNVERIFIED**, R22 **UNVERIFIED**, R26 **PARTIAL** |

## 1. Purpose and scope

One disposable Supabase project to produce evidence that cannot be produced locally, for
three requirements with different failure modes.

| Requirement | What the environment can establish | What it cannot establish |
| --- | --- | --- |
| **R21** | whether the real authentication boundary rejects forged tokens, and what it does with expired and foreign-audience tokens | app-side JWT logic — there is none; `api/_utils/auth-utils.js` delegates to `supabase.auth.getUser()` |
| **R22** | real PostgreSQL policy enforcement reached through **PostgREST** with real session claims | that production data or volume behaviour is correct |
| **R26** | separate layers: what RLS grants (little) versus what application routes authorise (most) | product-level institution semantics owned by the application |

Non-goals: performance testing, migration authoring, any contact with production or the
existing staging project, any real student data.

## 2. Required services and configuration

| Service | Configuration | Why |
| --- | --- | --- |
| PostgreSQL | Supabase default version; **all 106 migrations replayed** | R22 / R26 |
| GoTrue (Auth) | email+password enabled, email confirmation **off**, sign-ups disabled after seeding | the application authenticates with a password grant |
| PostgREST | `public` schema exposed; `anon` and `authenticated` roles active | R22 must traverse the same REST layer production uses |
| Extensions | **`pgcrypto` installed in the `extensions` schema** | `20261005031812_create_orchestration_persistence_rpc.sql` calls `extensions.digest(...)`, which is schema-qualified |
| `supabase_migrations` schema | present (Supabase default) | `20261011220034_expose_migration_history_for_drift_check.sql` reads it |
| JWT expiry setting | lowered for the duration of the run (§5) | enables genuine expiry observation |
| JWT signing keys | **symmetric (legacy secret) is required for any minted-token test** | asymmetric private keys are not exportable, which makes minting impossible |

Verified absent from all 106 migrations, therefore **not required**: Storage, Realtime,
Edge Functions, `pg_cron`, Vault, `pg_net`.

## 3. Migration compatibility plan

| Item | Requirement |
| --- | --- |
| Replay | apply all **106** migrations in lexical order; record per-file outcome |
| Expected local gaps now covered | `pgcrypto` (known local failure) and `supabase_migrations` (known local failure) should both apply here |
| Acceptance | **106/106 applied, zero skipped**; a failure is reported as a finding, never worked around |
| Prohibited | editing a migration to make the environment pass; running against production or staging |
| Local baseline | PGlite applied 104/106 with exactly those two exceptions |

Record the Postgres and GoTrue versions of the disposable project **and** of the production
project before drawing conclusions; a version mismatch is itself a limitation.


## 4. Synthetic data model

Fixed identifiers so evidence is reproducible and citable.

| Entity | Instance A | Instance B |
| --- | --- | --- |
| `institutions.school_code` (6 chars, `^[A-Z0-9]{6}$`) | `ZZA001` | `ZZB002` |
| admin | `r21a-admin@example.invalid` | `r21b-admin@example.invalid` |
| instructor | `r21a-instr@example.invalid` | `r21b-instr@example.invalid` |
| student | `r21a-student@example.invalid` | `r21b-student@example.invalid` |
| classroom rows | `classes` / `enrollments` / `assignments` prefixed `A-` | prefixed `B-` |
| activity rows | `attempts` / `attempt_answers` / `replays` / `completions` prefixed `A-` | prefixed `B-` |

All addresses use `.invalid` (RFC 2606). Seed one additional authenticated user with **no
institution membership** to exercise the unaffiliated path. Seed only via the Admin API with
the service-role key.

## 5. Authentication testing — corrected method

The production boundary is GoTrue, reached through `supabase.auth.getUser()`
(`GET /auth/v1/user`). Three properties behave differently from the intuitive assumption,
and getting this wrong produces confident nonsense.

| Property | Correct method | Expected | What it proves |
| --- | --- | --- | --- |
| **Forged signature** | structurally valid token signed with a random key | **401** | signature enforcement at the real boundary |
| **`alg: none`, malformed, empty bearer** | unsigned / broken tokens | **401** | parse and algorithm handling |
| **Expiry** | obtain a **real session** via password grant, lower `jwt_exp` to 60 s, present the *same token* after it has expired | **401**, and re-sign-in returns **200** | genuine expiry enforcement |
| **Audience** | correctly signed token with a foreign `aud` | **unknown — record observed** | behaviour of `aud`, whichever way it goes |

Two traps this corrects:

1. **A minted "expired" token does not test expiry.** GoTrue's user endpoint requires the
   session named in the token to exist (`session_id` claim). A token you sign yourself has
   no session, so it is refused as `session_not_found` — the same 401 an expired session
   produces. That "pass" measures session lookup, not `exp`. Only a real session whose token
   has actually expired isolates expiry.
2. **Audience is probably not enforced.** Neither the GoTrue user endpoint nor PostgREST
   validates `aud` beyond signature and role. A correctly signed foreign-audience token may
   therefore legitimately return **200**. That is a finding about the enforcement surface,
   not a failing test, and the R21 criterion must be re-scoped to "documented `aud`
   behaviour" rather than "audience enforcement verified".

Additional notes:

- Minting any correctly signed token requires the **symmetric** JWT secret. If the isolated
  project uses asymmetric signing keys (private key not exportable), audience and any other
  signed-token-negative test is **impossible** and must be recorded as such.
- A **200 proves only that the request succeeded**, not that the token's signature was
  verified. The forged-signature probe is the complementary evidence; the two must be cited
  together.
- The service-role key must never be present in a probe step, so a forged
  `role: service_role` claim can be tested without any legitimate high-privilege token in
  reach.

## 6. Row-level security versus application-level institution authorization

These are two different mechanisms and must be evidenced separately. Treating them as one
is the easiest way to overstate R26.

| Layer | Where it lives | What the isolated environment can prove |
| --- | --- | --- |
| **RLS** | PostgreSQL policies attached to tables | exactly which rows and verbs a given `anon`/`authenticated` session is allowed |
| **Application authorization** | route code using the **service role** plus explicit filters | only testable by calling the real routes; RLS does not participate, because the service role bypasses it |

Established facts about this repository that shape the test:

- **41 policies across 13 tables**, and RLS is enabled on **71 tables**. Most protected
  tables therefore rely on having *no* policy at all, which is deny-all for the API roles.
- There are **zero institution- or school-named policies**. Institution tables
  (`institutions`, `institution_memberships`, `institution_cohorts`, `institution_settings`,
  `student_institution_claims`, `institution_email_domains`) have RLS enabled and **no
  policies**, so for `authenticated` they are deny-all. In production this data is reached
  through the service role in route code.
- `instructor_school_verifications` has **no RLS enabled at all** — a border case to test
  explicitly rather than assume.
- `classes` (8 policies) and `enrollments` (4 policies) are the closest thing to
  institution-adjacent enforcement available at the RLS layer.

Consequences for R26:

1. **RLS-layer assertion (provable through PostgREST):** an authenticated institution-A user
   receives **zero rows** from institution-B's institution tables and from B's classroom
   rows, and is refused writes. This demonstrates that *RLS does not implement institution
   isolation*.
2. **Route-layer assertion (provable only through the application):** the same user hitting
   the application's own endpoints receives 403/empty results for B's records while
   succeeding for A's. That is where institution authorization actually lives, and it must be
   tested against the routes, not PostgREST.
3. A requirement that only (1) is satisfied must be recorded as **PARTIAL**, not verified.

## 7. Environment variables and secrets

| Variable | Scope | Handling |
| --- | --- | --- |
| `SUPABASE_URL` | GitHub environment secret | allowlisted host in every runner; production and staging hosts refused |
| `SUPABASE_ANON_KEY` | secret (publishable) | sent as `apikey`; never logged |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret, seed and teardown jobs only** | never present in a probe step |
| `R21_TEACHER_EMAIL` / `R21_TEACHER_PASSWORD` | secret | dedicated identity, following the pattern merged in #1153 |
| project JWT secret | **only** if a signed-token-negative test is required (§5) | throwaway project only; destroyed at teardown; never copied from production |
| `JWT_EXPIRY_SECONDS` | not secret (`60` during the run) | documents the isolation setting |

Hard rules: no production or staging key is ever placed in this environment; no secret is
printed, echoed, committed, or pasted into an issue; credentials are created directly in the
environment's settings.

## 8. Safety controls

| Control | Requirement |
| --- | --- |
| Isolation | a separate Supabase project, ideally in a separate organisation; no shared keys with staging or production |
| No production contact | every runner hard-codes an allowlist of the disposable project ref |
| Dispatch-only automation | all jobs `workflow_dispatch` with two confirmation inputs, a `concurrency` guard and `timeout-minutes` |
| Least privilege | `permissions: contents: read`; service-role key limited to seed/teardown jobs |
| No secret leakage in output | response bodies never printed, tokens never echoed, no `set -x`, secrets passed via `env:` only |
| Write budget | synthetic rows only; deletes restricted to rows created by the run; no schema drops outside the throwaway project |
| Rate limits | request caps per job (the existing R21 runner already enforces 10) |
| Human gates | environment wait timer retained; no auto-merge of evidence PRs |
| Fidelity record | Postgres and GoTrue versions of both projects recorded before conclusions are drawn |

## 9. Cleanup procedures

1. Teardown deletes synthetic rows, or preferably drops the whole project.
2. Revoke every key, including any symmetric JWT secret used for minted-token tests.
3. Delete the GitHub environment and its secrets.
4. Delete evidence branches after merge; keep the reports.
5. Publish a short teardown record (project ref, timestamps, deletion confirmation) so the
   evidence chain shows the environment no longer exists.
6. Retention: keep the evidence JSON and logs; discard credentials.


## 10. Evidence acceptance criteria

**R21 — verified when all hold:**

- valid token → **200** on the read endpoint (positive control satisfied)
- forged signature, `alg: none`, malformed, empty bearer → **401** each
- **expiry**: real session token, genuinely past `exp`, → **401**; re-sign-in → **200**
- audience behaviour **recorded explicitly** as enforced or not enforced (both are acceptable
  outcomes; silence is not)
- results reproducible across two consecutive runs
- if the project uses asymmetric signing keys, audience is recorded as **UNVERIFIABLE** with
  the reason

**R22 — verified when all hold:**

- **106/106** migrations applied, zero skipped
- the policy matrix covers **all 13 policy-bearing tables**, with owner/authorized access
  succeeding and cross-tenant access failing for the applicable verbs
- per-table privilege audit: the role provably holds the privilege it was denied
- institution tables (RLS on, no policies): `authenticated` receives **zero rows**, not a
  privilege error
- `service_role` bypass recorded as production posture, and explicitly **not** counted as a
  pass
- any table not exercised is listed by name as a coverage gap

**R26 — verified only when both layers hold:**

- RLS layer: institution-A user sees zero rows of B's institution and classroom data
- route layer: the same user is refused by the application's own endpoints for B's records
  while succeeding for A's
- unaffiliated authenticated user gets zero rows, not an error
- satisfying only the RLS layer ⇒ **PARTIAL**, not verified

**Never a pass condition:** green CI, a successful request, or a `200` alone.

## 11. Finding — corrected policy inventory requires reconciliation

This specification was written after re-deriving the policy inventory case-insensitively,
which contradicts numbers previously reported.

| Metric | Previously reported | Corrected |
| --- | --- | --- |
| `CREATE POLICY` statements | 9 | **41** |
| Distinct tables with policies | 3 | **13** |
| Tables with RLS enabled | 10 | **71** |
| Institution-named policies | "not testable / none exist" | **0 exist, but institution tables do have RLS enabled** |

Corrected distribution:

```
classes 8 · syllabi 4 · syllabus_scenarios 4 · enrollments 4 · replays 4
completions 4 · assignments 4 · telemetry_events 4 · profiles 1
scenario_catalog 1 · external_data_resources 1 · diagnostic_data_domains 1
external_resource_domain_links 1
```

**Root cause of the earlier numbers:** those greps were case-sensitive while the migration SQL
is lowercase, so `CREATE POLICY` counted only the files that happened to use uppercase. The
lesson generalises: any inventory derived from these migrations must be matched
case-insensitively, and should be asserted in CI rather than eyeballed.

**Coverage gap this exposes.** The merged R22 PGlite harness exercises `syllabi`,
`syllabus_scenarios` and `scenario_catalog` — **3 of 13 tables and 9 of 41 policies (22%)**.
The merged evidence document's §6 statement that the policy surface "is owner-scoped … there
is no institution predicate on these tables, so this says nothing about institution isolation"
is correct *about the three tables tested* and **incorrect as a statement about the
repository**, because `classes`/`enrollments` carry institution-adjacent policies and five
institution tables carry RLS.

Reconciliation actions (not performed by this document — documentation only):

1. Correct `docs/security/R22-PGLITE-RLS-EVIDENCE.md` §4a/§6, and state the coverage ratio
   (3/13 tables, 9/41 policies) next to the 32 passing assertions.
2. Extend the PGlite harness to the remaining ten policy tables, plus an explicit deny-all
   assertion for the institution tables and a check that `instructor_school_verifications`
   has no RLS.
3. Add a CI guard that fails when a table gains a policy without harness coverage, so coverage
   cannot silently shrink again.
4. Keep **R22 UNVERIFIED** throughout: none of this substitutes for Supabase/PostgREST
   equivalence.

## 12. Sequencing and cost

| Step | Effort | Gate |
| --- | --- | --- |
| 1. Create project; set `jwt_exp`; install `pgcrypto` in `extensions` | ~15 min | authorisation |
| 2. Replay 106 migrations; record matrix | ~15 min | 106/106 |
| 3. Seed institutions, users, classes | ~30 min | deterministic identifiers |
| 4. R22 policy matrix (13 tables) + privilege audit | ~2 h | all rows green |
| 5. R26 route-layer tests | ~1–2 h | A≠B enforced at the route |
| 6. R21 with real GoTrue sessions (expiry) | ~1 h | expiry isolated from session lookup |
| 7. Teardown and record | ~10 min | deletion confirmed |

A free-tier project is sufficient; exactly one project, deleted at the end.

## 13. Risks

- **Fidelity drift** — different Postgres/GoTrue versions than production. Mitigation: record
  and compare versions before concluding.
- **Service-role blindness** — most application traffic uses the service role, so RLS results
  describe the REST-facing posture only. This is why §6 splits the layers.
- **Secret sprawl** — a new project means new keys; teardown must be budgeted, not deferred.
- **Scope creep** — 13 tables × 4 verbs is real work. Timebox it and record partial coverage by
  name rather than sampling silently.
- **Repeat of the inventory error** — mitigated by §11 item 3.

## 14. Status

| Requirement | Status |
| --- | --- |
| R21 — JWT verification | **UNVERIFIED** |
| R22 — Supabase/PostgREST RLS equivalence | **UNVERIFIED** |
| R22 — PGlite regression coverage | Implemented in required CI (3 of 13 policy tables) |
| R26 — Institution isolation | **PARTIAL** |

This document provisions nothing and closes nothing. It defines what would have to be true for
those statuses to change.

