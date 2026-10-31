# Staging taxonomy retirement — controlled preflight

Migration: `20261013190000_retire_external_certification_taxonomy.sql`

## Current evidence (2026-10-25)

- GitHub staging drift: repository PR base has 106 migrations, staging has 105.
- Missing version: `20261013190000`. Do not insert a history row in lieu of execution.
- Read-only staging inspection: `scenario_questions.legacy classification column` and `scenario_catalog.legacy classification column` still exist.
- Staging observed counts: scenario questions 25 rows (22 populated classifications); scenario catalog 19 rows (0 populated classifications).
- This migration changes schema names and classification values; it is not a metadata-only correction.

## Read-only verification update — 2026-10-25

Validated directly against staging project `jchfruprqpeypdttvlam` (PostgreSQL 17.6):

- `scenario_questions`: 25 total; `legacy classification column` populated in 22 rows.
- `scenario_catalog`: 19 total; `legacy classification column` populated in 0 rows.
- Question classification distribution: null 3; `CI` 7; `DI` 4; `Electrical and Electrical Components` 4; `Mechanical Components` 1; `Starter System` 6.
- No relations detected under the checked legacy/new taxonomy names (`legacy domain relation`, `diagnostic_domains`, `legacy scenario map`, `scenario_diagnostic_area_map`, `legacy readiness view`, `diagnostic_readiness_summary`).
- Dependent view `public.scenario_question_readiness` references `question_id` and `scenario_id` on the affected relations, not the renamed classification column. Other application-level dependencies have not been excluded.
- None of the observed non-null classifications matches the migration's explicit legacy code replacements (`A1`–`A8`, `L1`, `L3`); as written, these 22 values would remain unchanged after the column rename. Require a documented intentional mapping/retention decision.
- A recoverable staging backup, restoration rehearsal, and independent DBA approval were **not verified**. Stop: no migration application or migration-history write.

## Required gates before application

1. Verify the exact target project reference is `jchfruprqpeypdttvlam` and that a recoverable staging backup or tested restore point exists.
2. Execute `tests/sql/staging-taxonomy-retirement-preflight.sql` with **read-only** credentials; record classification distributions, relation state, and dependent views.
3. Independently review the conversion of legacy classification values and any dependencies on renamed columns or views. Confirm application compatibility and the expected handling of all 22 populated records.
4. Have a DBA approve a maintenance window and documented restoration strategy. The migration is forward-only; rolling back requires a verified backup/restoration plan, not an invented reverse SQL script.
5. Apply the canonical migration **once** using the approved Supabase migration mechanism. Do not modify checksum, silently insert migration history, disable drift checks, or target production.
6. Re-run this preflight (adapting its legacy-column queries after rename), verify the expected new columns and data mappings, and re-run staging migration parity. Stop if any discrepancy remains.

## Abort conditions

Missing backup evidence; wrong project reference; unexpected legacy/new columns coexisting; unreviewed dependent views; classification counts or mappings differing from the recorded report; unresolved application compatibility; or failure of an approved migration procedure.

**Status: preflight-only; staging migration NOT applied; PR #1063 remains unmerged.**
