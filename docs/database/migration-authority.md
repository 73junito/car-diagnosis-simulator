# Migration authority and integrity baseline

Status: Phase 2A (local, uncommitted). No database was contacted for this record.

## 1. Authoritative migration sequence

| Path | Role | Evidence |
| --- | --- | --- |
| `supabase/migrations/` | **Canonical** sequence for Supabase-managed application schema (106 files, `20260710204828` to `20261013190000`) | `db/migrations/MIGRATION-FLOW.md` documents committing to `supabase/migrations/`; `docs/phase-4-functional-gap-roadmap.md` states the legacy surface is superseded by canonical Supabase migrations; `.github/workflows/supabase-migration-drift.yml` compares this history with staging and production; `.github/workflows/staging-taxonomy-deployment-preflight.yml` asserts the specific canonical file before any staging action |
| `db/migrations/` | **Legacy / historical** (6 SQL files plus `MIGRATION-FLOW.md`) | Retained for history. It is **no longer applied by any workflow**: `apply-migrations.yml` was re-targeted at the canonical chain (see section 3). New schema changes belong in `supabase/migrations/` only |

Ownership statements:

- New application schema changes belong in `supabase/migrations/` only.
- `db/migrations/` is retained for history. It is **not** deleted, consolidated or reordered here, and its workflow is unchanged by Phase 2A.
- The trademark policy guard already exempts `db/migrations/` as a historical prefix (`scripts/verify-prohibited-trademark-policy.js`).

## 2. Target databases

| Environment | Project ref | Evidence | Verified by this phase |
| --- | --- | --- | --- |
| Staging | `jchfruprqpeypdttvlam` | `scripts/assert-staging-supabase.js`, `supabase-migration-drift.yml`, `staging-taxonomy-deployment-preflight.yml` | No — no credentials were used |
| Production | `pffdgqpynpbffbcnxmum` | `supabase-migration-drift.yml` (hard-coded URL), `_headers` CSP `connect-src` | No — no credentials were used |

Migration history is exposed only through `public.app_migration_history()` (migration `20261011220034_expose_migration_history_for_drift_check.sql`), a `security definer` function returning `version` and `name`, revoked from `public`, `anon` and `authenticated` and granted to `service_role` only.

## 3. PostgreSQL version requirement

`supabase/config.toml` declares `major_version = 17`. The canonical sequence does create at least one extension itself — `supabase/migrations/20261005031812_create_orchestration_persistence_rpc.sql` opens with `create extension if not exists pgcrypto;` — while the `anon`/`authenticated`/`service_role` roles and the `supabase_migrations` schema are provisioned by the Supabase platform rather than by the SQL files.

Consequences:

- Any disposable runtime must supply the platform roles, the preinstalled extension catalogue **and** permission for migrations to create extensions. A pinned `supabase/postgres:17.*` image (or a pinned Supabase CLI local stack) is required; a vanilla image must not be assumed sufficient.
- Extension state is part of schema parity: Phase 2B must compare `pg_extension` alongside relations, policies, constraints, indexes, triggers and functions.
- **Resolved.** `.github/workflows/apply-migrations.yml` no longer uses `postgres:14`. The migration-validation job now runs `scripts/validate-migrations-disposable.js`, which starts the digest-pinned `ghcr.io/supabase/postgres:17.6.1.167@sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb` image with `--network none`, no published port and no host mount, waits for complete initialisation (the entrypoint cycles the server, so the probe runs over TCP and the postmaster start time must repeat), creates the documented **empty** `supabase_migrations.schema_migrations` relation, applies `supabase/migrations` with `psql -v ON_ERROR_STOP=1`, then evaluates the table access policy against `docs/database/table-access-policy.json`. Migration history is never written and the container is removed afterwards. The legacy `db/migrations/` set is no longer applied by any workflow.

## 3.1 Table access policy

`docs/database/table-access-policy.json` is the reviewed source of truth for
`anon`/`authenticated` privileges on public tables. `scripts/verify-table-access-policy.js`
compares a live database against it and fails closed on a missing privilege, an
unexpected privilege, an unknown table, a missing object, a missing role, an
unresolved classification, or a failed query.
`scripts/verify-table-access-policy-manifest.js` verifies the manifest against its
declared sources without touching a database: it fails on a canonical table
missing from the manifest, an unknown policy entry, an invalid classification,
an unsupported privilege, or a policy that contradicts the migrations without a
recorded owner decision. It never regenerates policy from database grants.

The previous `db/scripts/grants_audit.sql` rule ("every public base table must
grant SELECT to `authenticated`") contradicted the deliberate service-role-only
model: on a Supabase-compatible runtime it reported 124 tables, **all of which
are intentional restrictions**. `grants_audit.sql` is retained unchanged as a raw
inventory.

### Status: implemented and validated in a disposable instance, not in live databases

Supabase default privileges grant `anon`, `authenticated` and `service_role` the
full `arwdDxtm` set on every table created in `public`. The canonical chain
revoked selectively, so 11 tables retained the full set for `anon` and 15 for
`authenticated`.

`supabase/migrations/20261022000000_enforce_least_privilege_public_schema.sql`
corrects that. Status of the evidence:

| Statement | Evidence |
| --- | --- |
| Applied in a disposable Supabase PostgreSQL 17 instance | **Verified**: 107/107 canonical migrations applied with `ON_ERROR_STOP=1` |
| Policy audit passes there | **Verified**: 75 tables, 150 role comparisons, 0 violations |
| `anon` holds no table privilege | **Verified**: 0 tables |
| Canonical `authenticated` grants preserved | **Verified**: exactly the 9 tables the chain grants |
| Default privileges no longer grant clients | **Verified**: `anon`/`authenticated` absent from `pg_default_acl` for both `postgres` and `supabase_admin` |
| RLS preserved | **Verified**: 75 tables with RLS, 29 policies |
| Column-level grants | **Verified**: no true column ACLs exist (0) |
| **Staging and production privilege state** | **NOT VERIFIED.** No live database was contacted. Whether staging or production carry the same default-ACL grants is unknown |
| Sequence `USAGE` and function `EXECUTE` for `anon`/`authenticated` | **NOT REMEDIATED.** The manifest and audit cover tables only; 8 sequence and 4 routine grants remain |

## 4. Integrity baseline

`docs/database/migration-integrity-baseline.json` records, for every canonical migration, its version, repository path, SHA-256 hash and byte length.

One historical filename contains the retired vendor token, so that path is serialised with a JSON unicode escape (`pathEncoding` records the rule). Decoding yields the exact repository path, so comparisons stay literal while the trademark guard remains satisfied without modification.

Adoption semantics, recorded in the manifest itself (`hashHistory`):

> SHA-256 hashes are authoritative from the adoption date forward. No trustworthy pre-adoption hash history exists, so earlier modification can be neither proven nor disproven.

The manifest therefore establishes immutability from adoption; it does not make a claim about earlier history. Where historical evidence exists it lives elsewhere (`docs/database/staging-restore-baseline-39172287178.json`, `docs/database/staging-taxonomy-migration-rehearsal.md`) and describes database state, not file content.

## 5. Validator

`scripts/verify-migration-integrity.js` is deterministic, dependency-free and side-effect free unless `--write` is passed.

| Command | Behaviour |
| --- | --- |
| `node scripts/verify-migration-integrity.js` | Verify the repository against the baseline |
| `node scripts/verify-migration-integrity.js --allow-pending` | Report pending additions without failing (local convenience) |
| `node scripts/verify-migration-integrity.js --json` | Machine-readable result |
| `node scripts/verify-migration-integrity.js --write` | Regenerate the reviewed baseline (preserves adoption metadata and approved no-op pairs) |

Violation codes: `INVALID_FILENAME`, `DUPLICATE_VERSION`, `EMPTY_MIGRATION`, `MISSING_MIGRATION`, `MIGRATION_CONTENT_CHANGED`, `BACKDATED_ADDITION`, `DUPLICATE_CONTENT`, `BASELINE_MISSING_ENTRY`.

Exit codes: `0` satisfied, `1` integrity violation, `2` baseline or configuration error.

Duplicate-content migrations are **not** silently dropped from the comparison: they fail unless the exact pair is listed in `approvedDuplicateContent` as an intentional, reviewed no-op.

## 6. Adding a migration (from Phase 2A onward)

1. Create `supabase/migrations/YYYYMMDDHHMMSS_lower_snake_case.sql` with a new version greater than the newest baselined version.
2. Run `node scripts/verify-migration-integrity.js` — a new version is reported as `BASELINE_MISSING_ENTRY`.
3. Run `node scripts/verify-migration-integrity.js --write` and commit the regenerated manifest in the same change.
4. Never edit, rename or delete an already-baselined migration; corrections go in a new migration.

## 7. Not covered yet

- Actual schema parity against staging or production (Phase 2B), including columns, types, extensions, indexes, triggers, functions and RLS policies beyond the ad-hoc checks in `supabase/verification/04_security_audit.sql`.
- Disposable PostgreSQL 17/Supabase-compatible apply tests (Phase 2C).
- The staging taxonomy mismatch itself (Phase 2D), which needs its own approved database recovery action; `scripts/sql/staging-taxonomy-recovery-preflight.sql` and `docs/database/staging-taxonomy-recovery-gate.md` (PR #1076) own that path.
- Scheduled read-only drift detection (Phase 2E) and recovery/rollback documentation (Phase 2F).

## 8. Interaction with open work

| PR | Relationship |
| --- | --- |
| #1084 | Adds `scripts/sql/verify-taxonomy-migration-applied.sql` and the schema-probe gate. Phase 2A does not duplicate them and does not touch the trademark guard |
| #1063 | Adds `supabase/migrations/20261018050000_create_obd_reference_catalog.sql`; it must regenerate the baseline in the same PR |
| #1076 | Owns the staging recovery gate and preflight SQL; Phase 2A adds no recovery SQL |
