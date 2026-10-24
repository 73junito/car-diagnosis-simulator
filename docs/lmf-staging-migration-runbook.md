# Staging canonical taxonomy migration — controlled recovery checklist

Scope: staging Supabase project `jchfruprqpeypdttvlam` ONLY. Canonical file: `supabase/migrations/20261013190000_retire_external_certification_taxonomy.sql`. This procedure does **not** authorize production changes.

## Verified preflight (2026-10-24)

- Staging migration parity failed: 105 records versus 106 in canonical base (main commit `25e32b08c9df3476858b48800f99f576804fa692`).
- The legacy taxonomy-area columns still exist in both `scenario_questions` and `scenario_catalog`; their replacement `diagnostic_area` columns do not. This is an unapplied schema change, not merely missing tracking history.
- Zero matching A1–A8/L1/L3 code values were found in either legacy column at inspection time; this does not establish future or concurrent write safety.
- No `public` function or view text references to those columns were found in the limited scan.
- No triggers were returned for those two tables; their existing SELECT RLS policies are `scenario_catalog_read_active` (authenticated, active records) and `scenario_questions_read_all` (public, true). Their predicates do not reference the renamed column. Application-side consumers are not proven safe.
- CI, auth-aware smoke, CodeQL and LMF contracts passed on `bd82b1d7`; release evidence remains intentionally blocked.

## Preconditions — stop if any missing

1. Confirm an actual, restorable staging backup or PITR checkpoint **with timestamp and recovery owner**, plus a rehearsal or documented restore procedure. Do not assume dashboard backup availability.
2. Review application reads/writes, generated types, API response contracts, views, functions, RLS, triggers, cron jobs, and any downstream reports that reference legacy taxonomy columns, domain tables, mapping tables or code identifiers; update incompatible consumers before migration.
3. Check current migration history directly again; reject duplicate or out-of-order application. Review the exact migration SQL and the environment/project reference, and arrange a change window if necessary.
4. Agree on post-change validation and owners before applying. Use the approved staging migration mechanism; **never insert migration history manually** or change the parity baseline to mask divergence.
5. Ensure recovery uses verified backup restoration or a separately reviewed forward correction; a simple reverse rename is not a complete rollback because the migration may also rewrite taxonomy code values and remove legacy lookup data.

## Post-application acceptance

- Verify staging migration history contains the canonical version, and parity passes against `main`.
- Assert the replacement `diagnostic_area` column is present and the retired taxonomy column is absent in both tables; check renamed tables and mapped values where applicable.
- Re-run authenticated API smoke, catalog/question retrieval, RLS/tenant isolation tests, data integrity tests, and relevant UI regression suites against staging.
- Document actual migration execution ID, timestamp, operator, backup proof, validation artifacts, and reviewer. If tests fail, halt rollout and follow the rehearsed recovery path.
- Leave `P0-migration-parity` pending until independent review is recorded. This runbook and previous read-only checks are not passing release evidence.

No migration execution or backup validation was performed merely by writing this file.
