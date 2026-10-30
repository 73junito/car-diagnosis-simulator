# LMF staging taxonomy rehearsal: restored-copy validation

Evidence date: 2026-10-24 (US Central). This document records independently queried checks, not a release approval.

## Scope

- Original, **unchanged** staging: `jchfruprqpeypdttvlam` (`torquemind-staging`).
- Isolated restored copy: `nbgvllelsfhnmuwuqlkw` (`autolearnpro`).
- Source backup: physical backup dated 2026-10-24 13:24:39 UTC; Supabase dashboard reported restored-to-new-project operation COMPLETED at 2026-10-25 00:22:29 UTC.
- Canonical SQL source: `supabase/migrations/20261013190000_retire_external_certification_taxonomy.sql` from `main`.
- Applied the SQL **only to restored copy** through the Supabase migration operation. Tool-assigned test migration version: `20261025003714`; this version is **not** the canonical staging history version and must not be used as parity evidence.

## Observed results

| Comparison | Staging | Restored after rehearsal | Conclusion |
|---|---|---|---|
| Public tables before rehearsal | 76 | 76 | Matching inventory count |
| Scenario questions | 25 | 25 | Count preserved |
| Scenario catalog | 19 | 19 | Count preserved |
| Legacy area columns on both tables | 2 | 0 | Renamed on restored copy |
| Replacement diagnostic area columns | 0 | 2 | Present on restored copy |
| Null area values (questions) | 3 | 3 | Unchanged |
| Null area values (catalog) | 19 | 19 | Unchanged |
| PK, FK, CHECK constraint names and types | Baseline | Same | Structurally matching |
| RLS SELECT policy definitions | Baseline | Same | Policy text preserved; not an authorization test |
| Anonymous read of `scenario_questions` / `scenario_catalog` | 401 + Postgres `42501` | 401 + Postgres `42501` | Access denial reproduced identically; see "Anonymous access contract" below |
| Normalized complete question-row content digest (MD5) | `178a63a464c7271c78714dfdc728b8bd` | Same | Matching at query time |
| Normalized complete catalog-row content digest (MD5) | `d41d8cd98f00b204e9800998ecf8427e` | Same | Matching at query time |

### Anonymous access contract

Anonymous REST reads of the two scenario tables were executed against **both** projects and compared. The original, unchanged staging project and the restored copy returned the **same** result: HTTP 401 carrying the Postgres error code `42501` (`insufficient_privilege`) with the hint `GRANT SELECT ON public.<table> TO anon`.

This is the expected contract, not a restore defect:

- The `anon` role holds no table-level `SELECT` grant on either table. `relacl` on staging shows `postgres` and `service_role` for `scenario_questions`, and `postgres`, `service_role` and `authenticated` for `scenario_catalog`. `has_table_privilege('anon', …, 'SELECT')` is `false` for both.
- The `scenario_questions_read_all` policy (`TO public`, `USING (true)`) and `scenario_catalog_read_active` policy (`TO authenticated`) are **row-filtering** policies. They filter rows for a role that already holds the table privilege; they do not confer it. A permissive policy therefore cannot make an ungranted table readable.
- The 401 status is a PostgREST mapping of the Postgres `42501` denial, so it does not indicate an authentication failure. The gateway accepts the credential and the request reaches the database.
- The anonymous denial is identical on the unchanged staging project, which confirms the restore reproduced the source grant state rather than altering it.

Credential handling was also compared. A legacy anon JWT and a modern publishable key are both accepted by the gateway and both reach the same `42501` denial; a publishable key must be sent as `apikey` only, because sending it as a bearer token makes PostgREST reject it with `PGRST301` before the table privilege check is reached. A key that the gateway does not recognise is rejected with the `sb-error-code: UNAUTHORIZED_INVALID_API_KEY` response header and no `code` field in the body, so the two failure modes are distinguishable without printing credentials. The read-only smoke asserts the denial contract and reports only allowlisted machine error codes.

The row digests were computed by serializing **all columns and values**, transforming the legacy area field name to the replacement field name before hashing, sorting serialized rows, then concatenating and hashing. A second comparison excluding both area fields also matched. MD5 here is a consistency fingerprint rather than a cryptographic security proof. These results describe the queried tables at inspection time; they do not constitute a full-database restore checksum.

## Outstanding, mandatory

1. Test actual `anon` and `authenticated` requests against the **restored project's** REST endpoint, with dedicated restored-project credentials and throwaway test accounts where appropriate. Verify unauthorized writes are rejected and any row visibility restrictions hold. The direct database inspection role is privileged; comparing policy definitions does **not** execute RLS as an end user.
   - **Anonymous read: done.** `scripts/smoke-restored-supabase-access.cjs` executes anonymous reads against the restored project's REST endpoint with restored-project credentials and asserts the denial contract (HTTP 401/403 with Postgres `42501`), which matches the unchanged staging project exactly. It also asserts that a malformed bearer token is rejected. The run is read-only, is bound to the restored project reference, and reports only allowlisted machine error codes so no credential material reaches the log. `tests/restored-supabase-access-smoke.test.js` covers that contract.
   - **Authenticated harness added (not yet release evidence):** `scripts/smoke-restored-supabase-authenticated.cjs` performs a read-only authenticated catalog GET when environment secret `RESTORED_TEST_USER_JWT` contains a dedicated short-lived test-user JWT from the restored project. Without this secret, it explicitly logs `NOT RUN`; a green optional job does **not** prove authenticated access. The token preflight checks only claims; Supabase must validate signature and authorize the request. Do not use service-role keys or personal user sessions.
   - **Still outstanding:** supply an approved short-lived disposable-user JWT to the isolated environment and observe a successful authenticated run; execute separately authorized unauthorized-write rejection tests using reversible, isolated fixtures; capture immutable evidence and independent review. No write tests have been executed by these smoke scripts.
2. Test application query contracts and UI/API flows against the restored project; explicitly inspect consumers that still request retired taxonomy fields. Never repoint production applications to the restored project.
3. Plan controlled staging execution using the canonical migration machinery. Do not substitute the generated restored-copy migration history version for the canonical version.
4. After staging deployment, recheck canonical migration parity, data integrity, authenticated smoke tests, CI, and release-evidence approvals. Keep PR #1128 draft until all required independent gates are satisfied.

## Staging parity remediation status

The `staging migration parity` gate is a genuine, independently confirmed divergence and is **not** a repository defect. The read-only gates required by `docs/database/staging-taxonomy-recovery-gate.md` and `docs/lmf-staging-migration-runbook.md` were executed on 2026-10-25:

| Gate | Evidence | Result |
| --- | --- | --- |
| Fresh restorable backup | `staging-encrypted-backup` run `40156128866`, artifact `encrypted-staging-database-40156128866` | success |
| Restore verification | `verify-staging-backup-restore` run `40156618194` against that artifact | `RESTORE VERIFICATION: PASS` |
| Schema classification (Gate A) | `staging-taxonomy-schema-probe` run `40156753598` | `unapplied` (determinate, `classifierExit=0`) |
| Deployment preflight | `staging-taxonomy-deployment-preflight` run `40156755853` against the new backup | pass |

The `unapplied` classification confirms the legacy area columns are still present on both staging scenario tables and the replacement `diagnostic_area` columns are absent, so version `20261013190000` was never applied rather than applied without a history row. Deployment readiness is therefore established, and the remaining step is the controlled application of the canonical file to staging under the gates in `docs/database/staging-taxonomy-recovery-gate.md`, which requires an owner decision on the deployment window. This work was **not** performed here: the recovery gate requires approval, and the gate explicitly forbids `migration repair`, `db reset`, blind `db push`, history-table edits and disabling the parity CI.

### Historical schema fingerprint mismatch — reconciled

The question "has the historical schema fingerprint mismatch been independently reconciled?" is now answered: **yes, and it is not schema drift.**

The restore-verification fingerprint is a digest over the normalised catalog inventory, so its value depends on the normalisation algorithm, not only on the schema. The algorithm changed on 2026-10-20 (commit `c744fc8d`), which pinned a fixed `search_path` for deparser output and derived a dense column ordinal with `row_number()`. The Oct 18 baseline was recorded under the older normalisation and the Oct 23 baseline under the current one, so their `schema_fingerprint` values differ even though the staging schema they describe is the same.

This was settled against **real restore evidence**, not by inspection. The matrix emitted by the genuine restore of encrypted staging backup `40156128866` (run `40156618194`) was compared against both baselines:

* against the current baseline (`staging-restore-baseline-40034471907.json`): **47/47 checks PASS**;
* against the superseded baseline (`staging-restore-baseline-39172287178.json`): **46/47**, with `schema_fingerprint` the *only* failure.

Every substantive expectation — schemas, extensions, roles, public objects, RLS, row counts, required tables, taxonomy state, integrity constraints and the migration-history set — is identical between the two baselines. The mismatch is therefore an **algorithm-version artifact**.

The conclusion is reproducible in CI: the restored-copy matrix is committed at `tests/fixtures/restore-verification-matrix-40156618194.json` and `tests/restore-verification-contract.spec.js` asserts both outcomes against it. `docs/database/restore-verification-spec.md` §3.2 records the versioning rule, and the workflow's default `baseline_manifest` now points at the current baseline so a future restore run is not failed by the superseded fingerprint alone.

The remaining owner decision is consequently only the **deployment window and authorization** for the controlled application of the canonical migration to staging.

No staging or production SQL changes were performed by these validation queries. The restored project may incur continuing cost.
