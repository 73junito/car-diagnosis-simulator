# R22 — Row-level security under a real PostgreSQL engine (PGlite)

**Status: PARTIAL — R22 remains UNVERIFIED.**
This document records reproducible evidence that the repository's RLS policies behave
correctly on a real PostgreSQL engine. It does **not** certify production-equivalent
Supabase behaviour, and it does not close R22.

| Field | Value |
| --- | --- |
| Base commit | `131daa44d5f39745ca32fc6b38ed9904962d707b` (`main` = PR #1132 squash) |
| Worktree | `/home/rod/r22-pglite` (branch `test/r22-pglite-rls`, **uncommitted**) |
| Harness | `tests/r22/pglite-rls-harness.mjs`, `tests/r22/README.md` |
| Engine | PostgreSQL **18.6** via PGlite 0.5.13 (wasm32, single connection, in-memory) |
| Migrations under test | `20260817012628_create_attempts.sql`, `20260821040000_create_syllabus_and_scenario_catalog.sql` |
| Assertions | **32/32 passed**, exit 0 |
| Dependency | `@electric-sql/pglite` **`0.5.13`** devDependency (Apache-2.0), lockfile-managed; `npm run test:r22` |
| Privileged changes required | none (no Docker, no sudo, no credentials) |

## 1. Why this harness exists

R22 requires real PostgreSQL RLS behaviour, which was blocked on this host: `rod` is not
in the `docker` group, the Docker socket is `root:docker` mode `0660`, sudo needs a
password, only `postgresql-client-16` is installed (no `initdb`/`postgres` server
binaries), and the LXD daemon is inactive. PGlite is the only unblocked real-engine
option.

## 2. Fidelity model — what is real and what is shimmed

Real (production code paths, not reimplemented):

- the migration SQL, including every `CREATE POLICY`, `USING` and `WITH CHECK` predicate;
- PostgreSQL privilege checks (`GRANT`/`REVOKE`) and RLS enforcement by the engine itself.

Shimmed (Supabase supplies these; PGlite does not):

| Shim | Purpose |
| --- | --- |
| roles `anon`, `authenticated`, `service_role` (`BYPASSRLS`) | policies are written `TO authenticated`; absent roles make every policy inert |
| schema `auth` + table `auth.users` | 42 migrations declare `REFERENCES auth.users(id)` |
| `auth.uid()` → `(request.jwt.claims ->> 'sub')::uuid` | the 41 policy predicates call it |
| `auth.jwt()` → `request.jwt.claims::jsonb` | parity for policies reading full claims |
| default grants to `anon`, `authenticated`, **`service_role`** | Supabase grants new `public` tables at creation, so a migration's own `REVOKE` still wins |

The default-grant shim is the most consequential one, in both directions:

- Omitting it makes RLS untestable — statements fail with `permission denied` before any
  policy is evaluated, so denials would pass for the wrong reason.
- Granting it to the wrong role set is also wrong: the harness's first run granted only
  `anon` and `authenticated`, so `service_role` was refused on `syllabi` despite having
  `BYPASSRLS`. Corrected to include `service_role`, mirroring Supabase.

This is exactly the false-confidence risk identified when scoping this work: a harness
that gets roles, privileges or session context wrong produces green results that mean
nothing.

## 3. Migration compatibility sweep

All 106 migrations were attempted in lexical order on one PGlite cluster (`--matrix`).
**104/106 applied.** The two exceptions are Supabase-platform features, not repository
defects:

| Migration | Reason |
| --- | --- |
| `20261005031812_create_orchestration_persistence_rpc.sql` | `extension "pgcrypto" is not available` (PGlite does not bundle it) |
| `20261011220034_expose_migration_history_for_drift_check.sql` | `relation "supabase_migrations.schema_migrations" does not exist` (Supabase-managed schema) |

Consequence: the harness applies only the two migrations required for the RLS surface
under test. A full-chain replay on PGlite is not equivalent to production.

## 4. Results — 32/32 assertions

Positive controls (an authorized owner must succeed, otherwise the denials prove nothing):

| Assertion | Expected | Result |
| --- | --- | --- |
| owner SELECTs own syllabus | 1 row | PASS |
| owner INSERTs own syllabus | 1 row | PASS |
| owner UPDATEs own syllabus | 1 row | PASS |
| owner SELECTs own scenario mapping | 1 row | PASS |
| owner INSERTs mapping onto own syllabus | 1 row | PASS |
| authenticated reads only ACTIVE catalog rows | 2 rows | PASS |

Cross-tenant reads:

| Assertion | Expected | Result |
| --- | --- | --- |
| other tenant SELECTs syllabi (sees only own) | 1 row | PASS |
| foreign syllabus invisible by direct id predicate | 0 rows | PASS |
| inactive catalog row invisible | 0 rows | PASS |

Cross-tenant writes — the cases R22 is actually about:

| Assertion | Expected | Result |
| --- | --- | --- |
| INSERT syllabus owned by other tenant | rejected `row-level security` | PASS |
| UPDATE other tenant syllabus | 0 rows affected | PASS |
| DELETE other tenant syllabus | 0 rows affected | PASS |
| INSERT mapping onto other tenant syllabus | rejected `row-level security` | PASS |
| UPDATE other tenant mapping | 0 rows affected | PASS |
| DELETE other tenant mapping | 0 rows affected | PASS |
| denied writes left syllabi intact | unchanged (3 rows) | PASS |
| denied mapping writes left data intact | unchanged (3 rows) | PASS |

Role boundary and the service-role posture:

| Assertion | Expected | Result |
| --- | --- | --- |
| anon SELECTs syllabi | 0 rows | PASS |
| anon INSERTs syllabus | rejected | PASS |
| service_role sees ALL syllabi | 3 rows (`BYPASSRLS`) | PASS |
| authenticated SELECT on `attempts` | rejected (privilege) | PASS |
| anon SELECT on `attempts` | rejected (privilege) | PASS |
| service_role SELECT/INSERT on `attempts` | allowed | PASS |

## 4a. Privilege audit — RLS denial vs ordinary permission denial

A zero-row result is only RLS evidence if the role actually holds the privilege it was
denied. This audit (added on review) makes the distinction explicit and machine-checked:

| Assertion | Expected | Result |
| --- | --- | --- |
| `authenticated` HOLDS `SELECT` on `syllabi` | true | PASS |
| `authenticated` HOLDS `INSERT` on `syllabi` | true | PASS |
| `authenticated` HOLDS `UPDATE` on `syllabi` | true | PASS |
| `authenticated` HOLDS `DELETE` on `syllabi` | true | PASS |
| `anon` HOLDS `SELECT` on `syllabi` yet sees 0 rows | true | PASS |
| `authenticated` LACKS `SELECT` on `attempts` | false | PASS |
| `service_role` HOLDS `SELECT` on `attempts` | true | PASS |
| RLS enabled on `public.syllabi` | true | PASS |

Consequence: every cross-tenant zero-row result and every `WITH CHECK` rejection reported in
§4 is **policy enforcement**, because the role provably held the privilege. By contrast the
`attempts` denial for `authenticated` is an **ordinary privilege denial** and is never
counted as RLS evidence in this document.

`attempts` is service-role-only by explicit `REVOKE`/`GRANT`, not by policy: it has RLS
enabled with **no** policies.

Tables observed with RLS enabled in this cluster: `attempts`, `scenario_catalog`,
`syllabi`, `syllabus_scenarios`.

## 5. What this establishes

- The repository's RLS policies for `syllabi`, `syllabus_scenarios` and
  `scenario_catalog` **do** enforce owner-scoped isolation on a real PostgreSQL engine,
  across SELECT/INSERT/UPDATE/DELETE, for `authenticated` and `anon`.
- The denials are **attributable to policy, not to missing grants**: the privilege audit
  (§4a) proves both roles held SELECT/INSERT/UPDATE/DELETE on `syllabi` while still being
  confined to their own rows. The opposite case is demonstrated too — `authenticated` on
  `attempts` is denied by privilege, and is not counted as RLS evidence.
- `public.attempts` is not reachable by the API roles at all.
- `service_role` bypasses every policy — so tenant scoping in production is
  **route-enforced whenever the service role is used**, the same conclusion R26 reached
  independently.

## 6. What this does NOT establish

- Supabase equivalence: PostgREST and GoTrue are absent; policies are evaluated via SQL
  with a shimmed `request.jwt.claims`, not via a GoTrue-issued JWT over PostgREST.
- Version parity: PGlite is PostgreSQL 18.6; a project may run a different major.
- Concurrency: one connection, no pooling, no statement timeout, no transaction races.
- Extension parity: `pgcrypto` and `supabase_migrations` are unavailable.
- Institution-level scope: the policy surface here is **owner-scoped**
  (`owner_id = auth.uid()`), not institution-scoped. There is no institution predicate on
  these tables to test, so this says nothing about institution isolation beyond what R26
  recorded for route code.

## 7. Dependency integration (approved)

`@electric-sql/pglite` is now a **pinned devDependency**, so the harness is reproducible
from a clean install instead of depending on a scratch directory:

```json
"@electric-sql/pglite": "0.5.13"     // devDependencies, exact version (no range)
```

| Property | Value |
| --- | --- |
| Version | `0.5.13` (exact pin, no caret) |
| License | **Apache-2.0** (recorded in the lockfile entry) |
| Integrity | `sha512-4rZuxK1k07w6sSpJzjMri0B9+HuXuC7V9pxVB51pR0T9KPqXg6TD0mdaEwBA9rkcL4jdht4tGDf/wYzAiGhT7g==` |
| Lockfile churn | package-lock.json **+8 lines**, no other package version changed |
| Runtime dependencies | none (PGlite ships no runtime deps and no peer deps) |
| Scripts added | `npm run test:r22`, `npm run test:r22:matrix` |

Result of re-running under the repository-managed dependency: harness resolves
`/home/rod/r22-pglite/node_modules/@electric-sql/pglite/dist/index.js`, **32/32 assertions
pass (exit 0)**, matrix unchanged at **104/106**. The `/tmp/r22-deps` path remains only as
an offline fallback and is no longer required.

## 8. Remaining blockers for R22

1. A production-equivalent database (Supabase project, or Postgres with the full
   extension set) to replay all 106 migrations and exercise RLS through PostgREST.
2. Real sessions: claims produced by GoTrue, not by a shim.
3. ~~Maintainer decision on the devDependency~~ — **resolved**: PGlite is pinned and
   lockfile-managed (see §7). It does not change any migration and does not make these
   results equivalent to Supabase.

## 9. Reproduction

```bash
cd /home/rod/r22-pglite
npm ci
npm run test:r22            # 32/32 assertions, exit 0
npm run test:r22:matrix     # 104/106 migrations applied
```

Recorded run artefacts: `/tmp/r22-repo-dep.log` (repository-managed dependency run),
`/tmp/r22-run2.log`, `/tmp/r22-evidence.json`, `/tmp/r22-matrix.log`.
Nothing was committed, pushed, merged or deployed, and no migration was modified.

