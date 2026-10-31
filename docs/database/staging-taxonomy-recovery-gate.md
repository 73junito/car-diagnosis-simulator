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

## Gate 4 — schema equivalence for the absent diagnostic relations (resolved 2026-10-25)

Gate 4 asks whether the absent `diagnostic_domains`, `scenario_diagnostic_area_map`
and `diagnostic_readiness_summary` relations are intentionally absent or require a
separate approved schema reconciliation. **They are intentionally absent, and no
separate schema reconciliation is required.** The canonical path was traced to its
source:

* No canonical migration creates any of the three relations. The only canonical
  relations in the vendor-neutral taxonomy area are `public.competency_areas` and
  `public.competency_to_program_map`, created by
  `supabase/migrations/20260911200000_add_vendor_neutral_competency_foundation.sql`.
* `supabase/migrations/20261013190000_retire_external_certification_taxonomy.sql`
  only **renames** such relations *when they already exist*. Every branch is
  guarded by `to_regclass(...) is not null`, so on staging — where neither the
  legacy nor the neutral relation exists — all three rename blocks are skipped.
  The migration's net effect on staging is therefore the two column renames and
  the label mapping, nothing more.
* `supabase/seed/diagnostic_domains.sql` and
  `supabase/seed/scenario_diagnostic_area_map.sql` are **reference material for
  explicit human review**, not an automated seeding path. Both are plain `insert`
  statements that require their target relation to already exist.
  `supabase/seed/README.md` states that none of these optional tables has been
  verified in staging, so none is included automatically, and `supabase/seed.sql`
  is a fail-closed no-op that creates no assessment content.
* `supabase/verification/01_staging_inventory.sql` probes for
  `diagnostic_domains` and `scenario_diagnostic_area_map` as an inventory
  observation. It is a read-only probe, not a parity assertion.

The independent rehearsal against a restored copy confirms the same conclusion:
see `docs/database/staging-taxonomy-migration-rehearsal.md` §4 finding 4, which
records the relations as "absent by design … This is not a restoration gap."

**Consequence for the owner decision:** applying the canonical migration to
staging is not expected to create these three relations, and their continued
absence afterwards is **not** a failed post-condition. Gate 4 must be satisfied by
this determination, not by creating the relations. Creating them would be a
*separate* approved schema change with its own migration, and is out of scope here.

## Forbidden shortcuts
- No `migration repair --status applied` unless a separately verified prior execution truly occurred.
- No `db reset`, blind `db push`, history-table edits, dropping unexpected tables, or disabling parity CI.
- No production database writes.
- No migration deployment until all gates above are satisfied.

## Exit criteria
Recorded version is 20261013190000, actual schema/data are validated, affected rows remain accounted for, the restoration evidence is retained, and the staging-parity job passes.

## Restore-evidence reconciliation (2026-10-25)

The restore evidence required by gate 1 is in place and the historical schema
fingerprint mismatch has been reconciled, so the only outstanding owner decision
is the deployment window and authorization for gate 5.

| Item | Evidence | Result |
| --- | --- | --- |
| Fresh restorable backup | `staging-encrypted-backup` run `40156128866`, artifact `encrypted-staging-database-40156128866` | success |
| Restore verification | `verify-staging-backup-restore` run `40156618194` against that artifact | `RESTORE VERIFICATION: PASS` (47/47) |
| Schema classification (gate A) | `staging-taxonomy-schema-probe` run `40156753598` | `unapplied` (determinate) |
| Deployment preflight | `staging-taxonomy-deployment-preflight` run `40156755853` | pass |

The historical fingerprint mismatch is an **algorithm-version artifact, not schema
drift**. `schema_fingerprint` is a digest over the normalised catalog inventory,
so its value depends on the normalisation algorithm as well as on the schema. The
algorithm changed on 2026-10-20 (commit `c744fc8d`), after the Oct 18 baseline was
recorded. The genuine restore matrix from run `40156618194` was compared against
both baselines: **47/47 PASS** against the current baseline
(`staging-restore-baseline-40034471907.json`) and **46/47** against the superseded
Oct 18 baseline, with `schema_fingerprint` as the *only* difference. Every
substantive expectation is identical between the two baselines. The reasoning,
the version-binding rule and the reproducible CI assertion are recorded in
`docs/database/restore-verification-spec.md` §3.2 and
`tests/restore-verification-contract.spec.js`.

Applying the canonical migration to staging remains **not performed**: it requires
an owner deployment window and authorization, and the gates above forbid
`migration repair`, `db reset`, blind `db push`, history-table edits and disabling
the parity CI.
