# Staging taxonomy migration recovery gate

Scope: staging project `jchfruprqpeypdttvlam` only. Production `pffdgqpynpbffbcnxmum` is out of scope.

## Current evidence (2026-10-18)
- Canonical history: 106 migrations; staging history: 105; missing version `20261013190000`.
- The legacy area column on `scenario_catalog` exists (19 rows, all NULL). The retired vendor mark is written here as `a` + `se_area`, matching the assembly used in the preflight SQL.
- The same legacy area column on `scenario_questions` exists (25 rows: 3 NULL, 7 CI, 4 DI, 4 Electrical and Electrical Components, 1 Mechanical Components, 6 Starter System).
- Neither legacy nor diagnostic domain/map/readiness relation was found in staging. The canonical migration conditionally renames such relations but does not create missing ones.
- The exact historical migration is `supabase/migrations/20261013190000_retire_external_certification_taxonomy.sql`.
- The GitHub Actions parity gate is correctly FAILING. Do not disable it.

## Required execution gates
1. Record proof of a fresh **restorable** backup for this exact staging project, its restore timestamp, and restore procedure. A screenshot of a backup list is insufficient if restoring is not available.
2. Obtain a **data-equivalent disposable clone** of staging; validate row counts and dependencies with `scripts/sql/staging-taxonomy-recovery-preflight.sql`. Do not substitute the empty PR preview database.
3. Test the **unchanged canonical SQL** against the clone. Record errors, row counts, renamed columns, data mappings and validation of dependent views/functions. Validate rollback by restoring the clone.
4. Confirm whether absent diagnostic domain/map/readiness tables are intentionally absent in staging or require a separate approved schema reconciliation. Passing migration *history* parity does not prove schema equivalence.
5. With approval and a rollback plan, apply the same exact historical SQL to staging using a controlled migration mechanism that records original version `20261013190000` exactly once; do not generate a replacement timestamp. Execute in a transaction if supported by the migration mechanism and SQL.
6. After execution, verify history count/version, columns, row counts, label distributions, and downstream application queries. Rerun PR #1063 staging parity CI. Document evidence in the PR.

## Forbidden shortcuts
- No `migration repair --status applied` unless a separately verified prior execution truly occurred.
- No `db reset`, blind `db push`, history-table edits, dropping unexpected tables, or disabling parity CI.
- No production database writes.
- No migration deployment until all gates above are satisfied.

## Exit criteria
Recorded version is 20261013190000, actual schema/data are validated, affected rows remain accounted for, the restoration evidence is retained, and the staging-parity job passes.
