# Staging taxonomy migration rehearsal (dry-run) procedure and evidence

Scope: staging project `jchfruprqpeypdttvlam` only. Production `pffdgqpynpbffbcnxmum` is out of scope.

Pending migration rehearsed:

`supabase/migrations/20261013190000_retire_external_certification_taxonomy.sql`
(sha256 `9d68ed1ba6753e91657a2411784f86c10a10d1eb78dd1fe7dbc126edd5ce68d4`, unchanged,
byte-identical to the file on `main`).

## 1. Why a rehearsal is required

`origin/main` has 106 canonical migrations; staging history has 105. The missing
migration renames the retired vendor-prefixed columns/relations to vendor-neutral `diagnostic_*`
names and normalises labels. It mutates schema and, in some environments, data. It
must be rehearsed against a canonical database before it is applied to staging, and
the `staging migration parity` gate must not be disabled to clear the failure.

## 2. Procedure

All steps run inside a throwaway container. No staging or production connection is
made, and the local Supabase Docker volume is never touched.

```bash
# 0. Disposable container: no network, no volumes
docker run -d --name torquemind-taxonomy-rehearsal --network none \
  -e POSTGRES_PASSWORD=rehearsal-only \
  ghcr.io/supabase/postgres:17.6.1.167@sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb

# 1. Wait for COMPLETE Supabase initialisation (the image runs its own baseline
#    migrations on first start, which takes several minutes). Do not proceed on
#    pg_isready alone: the entrypoint cycles the server and init must be finished.
#    Gate on: 8 schemas present AND the graphql schema-version sequence queryable.

# 2. Stage the canonical migrations and harness (read-only copies)
docker cp supabase/migrations <container>:/work/migrations
docker cp scripts/rehearse-taxonomy-migration.sh <container>:/work/
docker cp scripts/sql/taxonomy-rehearsal-seed.sql <container>:/work/sql/
docker cp scripts/sql/taxonomy-rehearsal-verify.sql <container>:/work/sql/

# 3. Apply the canonical chain (all versions below the pending one) and dry-run
docker exec <container> bash -c \
  'cd /work && MIGRATIONS_DIR=/work/migrations bash /work/rehearse-taxonomy-migration.sh --dry-run'

# 4. Seed the staging value distribution (synthetic placeholders only)
docker exec <container> psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  -f /work/sql/taxonomy-rehearsal-seed.sql

# 5. Apply the UNCHANGED canonical migration
docker exec <container> psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  -f /work/migrations/20261013190000_retire_external_certification_taxonomy.sql

# 6. Verify
docker exec <container> psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  -f /work/sql/taxonomy-rehearsal-verify.sql

# 7. Idempotency: re-apply the same file and verify again
```

Rollback: the container is discarded. `--dry-run` additionally proves the migration
is transactional by executing it inside `BEGIN … ROLLBACK`.

## 3. Recorded evidence (executed 2026-10-19, local Docker)

| Step | Result |
| --- | --- |
| Canonical chain (versions < pending) | **105/105 applied** with `psql -v ON_ERROR_STOP=1`; any failure aborts the run |
| Pre-state columns | legacy vendor-prefixed column present on `scenario_catalog` and `scenario_questions` |
| Pre-state rows | `scenario_questions=0`, `scenario_catalog=19` (the chain seeds catalog only) |
| Dry-run (transaction + rollback) | **PASS** — `post_rename_inside_tx=2`; after `ROLLBACK` both tables showed the legacy column again |
| Apply unchanged migration | `DO` / `DO`, no errors |
| Verification (1st) | **11/11 PASS** |
| Post-state distribution | identical to pre-state (3 NULL, 7 CI, 4 DI, 4 Electrical…, 1 Mechanical…, 6 Starter System) |
| Idempotency (re-apply + verify) | no error, **11/11 PASS** again |

Verification checks executed: `legacy_vendor_prefix_column_absent`,
`diagnostic_area_present_on_both_tables`, `scenario_questions_row_count_preserved`,
`scenario_catalog_row_count_preserved`, `question_label_values_preserved`,
`catalog_labels_still_null`, `readiness_view_still_queryable`,
`primary_keys_intact`, `inbound_foreign_keys_intact`,
`no_retired_prefix_references_in_functions`, `rls_still_enabled`.

### 3.1 Original vs canonical schema comparison

Column sets for the affected objects — live staging (read-only probe) versus the
canonical rehearsal database — are **byte-identical**:

* `scenario_catalog`: `scenario_id:text,title:text,description:text,<legacy label column>:text,active:boolean,created_at:timestamptz,competency_area_id:uuid`
* `scenario_questions`: `id:uuid,scenario_id:text,question_text:text,option_a..d:text,correct_answer:text,explanation:text,difficulty:text,topic:text,<legacy label column>:text,created_at:timestamptz,question_id:text,competency_area_id:uuid`

Dependencies checked: the dependent view `public.scenario_question_readiness` does
not reference the legacy label column and stayed queryable; no function body
references it; 7 inbound foreign keys and both primary keys were preserved.

## 4. Findings and investigations

1. **The canonical chain is not self-applying on a bare database.** It depends on
   `supabase_migrations.schema_migrations`, which the Supabase CLI creates. The
   harness creates that relation (empty) as a documented shim. It never inserts
   history rows; no migration history is faked.
2. **The rehearsal must wait for complete image initialisation.** Starting the chain
   while `docker-entrypoint-initdb.d/migrate.sh` was still running produced
   `ERROR: could not open relation with OID …` from the Supabase
   `graphql.increment_schema_version()` event trigger.
3. **Canonical migrations alone do not reproduce staging data.** The chain seeds 19
   catalog rows and 0 question rows; staging has 19 and 25. Data assertions
   therefore require seeding — or, authoritatively, a restored dump.
4. **The absent `diagnostic_domains` / `scenario_diagnostic_area_map` /
   `diagnostic_readiness_summary` relations are absent by design.** No canonical
   migration creates them; the vendor-neutral foundation migration creates
   `competency_areas` and `competency_to_program_map` instead. The pending migration
   only renames those relations when they already exist, and every branch is
   existence-guarded, so on staging they are skipped. This is not a restoration gap.
5. **No label rewriting is expected on staging.** Staging's legacy label values
   (`CI`, `DI`, `Electrical and Electrical Components`, `Mechanical Components`,
   `Starter System`, NULL) match none of the `A1…A8` / `L1` / `L3` mapping keys, so
   the `case` expressions fall through to `else`. Only the two column renames take effect.

## 5. Limits of this rehearsal (read before applying to staging)

* The rehearsal database is built from canonical migrations plus a **synthetic seed**
  reproducing staging's value distribution for the affected column. It is **not** a
  data-equivalent clone: large tables such as `battery_temperature_telemetry`
  (425,862 rows) are absent.
* It therefore establishes migration **behaviour** (renames, counts, dependencies,
  idempotency, transactionality) — not whole-database restoration fidelity.
* The authoritative data-equivalent rehearsal is to run the unchanged migration
  against a restored backup copy. See `docs/database/restore-verification-spec.md`
  for the restore mechanism. The local run used
  `public.ecr.aws/supabase/postgres:17.6.1.167`, the same version as the
  digest-pinned GHCR image used in CI.

## 6. Forbidden shortcuts (unchanged from PR #1076)

* No `supabase migration repair --status applied` unless a separately verified prior
  execution truly occurred.
* No `db reset`, blind `db push`, history-table edits, dropped unexpected tables, or
  disabled parity CI.
* No production database writes.
* No deployment until the taxonomy recovery gates are satisfied.
