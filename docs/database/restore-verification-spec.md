# Restore verification specification

Scope: staging project `jchfruprqpeypdttvlam`. Production `pffdgqpynpbffbcnxmum` is out of scope.

This document is the machine-readable verification specification used by
`.github/workflows/verify-staging-backup-restore.yml`.

## 1. Purpose

Prove, on every restore verification run, that the encrypted staging backup:

1. is the exact ciphertext that was recorded (integrity), and
2. restores into a complete, structurally and numerically equivalent database.

A restore is only "verified" when `RESTORE VERIFICATION: PASS` is printed by
`scripts/verify-restore-baseline.js`. An exit code alone is not evidence.

## 2. Components

| Component | Role |
| --- | --- |
| `.github/workflows/verify-staging-backup-restore.yml` | Downloads the encrypted artifact, verifies the ciphertext, restores into a disposable container, emits the matrix, compares it to the baseline, uploads artifacts. |
| `scripts/sql/restore-verification-matrix.sql` | Read-only. Emits one JSON line describing a database (facts only, no PASS/FAIL). |
| `scripts/verify-restore-baseline.js` | Compares a matrix against a baseline manifest; prints per-check PASS/FAIL; writes a JSON report; exits non-zero on any failure. |
| `docs/database/staging-restore-baseline-<backup_run_id>.json` | Recorded expectations for one specific backup. Immutable. Bound to the fingerprint normalisation used at capture time; see §3.2. |

## 3. Verification checks

Every check is an **exact** comparison against the baseline manifest, because the
baseline describes the immutable backup contents.

| # | Check | Source |
| --- | --- | --- |
| 1 | `migration_history.count`, `max_version`, full `versions` list | `supabase_migrations.schema_migrations` |
| 2 | `schemas` exact set | `pg_namespace` (system schemas excluded) |
| 3 | `extensions` exact name/version map | `pg_extension` (`plpgsql` excluded) |
| 4 | `roles.required_present` (`anon`, `authenticated`, `postgres`, `service_role`, `supabase_admin`) | `pg_roles` |
| 5 | `public_objects.tables` / `views` / `rls_enabled` / `policies` | `pg_class`, `pg_policies` |
| 6 | `public_objects.rls_disabled` must be empty | `pg_class.relrowsecurity` |
| 7 | `rls.tables_total` / `tables_enabled` / `policy_count` (all schemas) | `pg_class`, `pg_policies` |
| 8 | `row_counts.*` for each baseline table | `count(*)` per table |
| 9 | `required_tables.missing` empty, `expected` count | `to_regclass` over the baseline table list |
| 10 | `taxonomy.*` (pre-migration state: legacy vendor-prefixed column present, `diagnostic_area` absent, legacy/neutral relation presence; the legacy identifier is assembled at run time) | `information_schema.columns`, `to_regclass` |
| 11 | `integrity.*` (primary keys, foreign keys, check constraints, unique constraints) | `pg_constraint` |
| 12 | `schema_fingerprint` | sha256 over the normalised catalog inventory |

### 3.1 Schema fingerprint normalisation

Included: schemas, relations (kind + RLS flag), columns (name, type, nullability,
ordinal), constraints (`pg_get_constraintdef`), indexes (`pg_get_indexdef`),
functions (identity arguments, `SECURITY DEFINER`, `proconfig`), policies (roles,
command, permissiveness, `qual`, `with_check`), triggers (`pg_get_triggerdef`),
extensions.

Excluded on purpose: ownership, ACLs/grants, OIDs, tablespaces, statistics,
sequence `last_value`, comments.

ACLs and ownership are excluded because `pg_restore` runs with `--no-owner --no-acl`,
so a faithful restore intentionally does not reproduce them. Grant-level
authorization is governed by the separate least-privilege workstream, not by this check.

### 3.2 Fingerprint algorithm versioning

`schema_fingerprint` is a digest over the normalised inventory above, so its
value is a function of the **normalisation algorithm**, not only of the schema.
The algorithm changed on 2026-10-20 (commit `c744fc8d`, "canonicalize restore
schema fingerprint deparsing"), which pinned a fixed `search_path` for
deparser output and derived a dense column ordinal with `row_number()`.

Consequence: a baseline recorded under an older normalisation is **not
comparable** with a matrix emitted by the current SQL, even when the underlying
schema is byte-for-byte identical. Two baselines are therefore in play:

| Baseline | Recorded | Fingerprint algorithm | `schema_fingerprint` |
| --- | --- | --- | --- |
| `staging-restore-baseline-39172287178.json` | 2026-10-18 | pre-`c744fc8d` | `9398496d…` |
| `staging-restore-baseline-40034471907.json` | 2026-10-23 | current | `acf49eaa…` |

The historical fingerprint is retained in the current baseline under
`diagnostics.historical_20261018_fingerprint`, and the current baseline also
records per-category digests under `diagnostics.schema_component_fingerprints`
so a future mismatch can be localised to a category instead of failing opaquely.

The two baselines were reconciled against **real restore evidence**, not
asserted. The matrix emitted by the genuine restore of encrypted staging backup
`40156128866` (workflow run `40156618194`) was compared against both:

* against the current baseline: **47/47 checks PASS**;
* against the superseded baseline: **46/47**, with `schema_fingerprint` the
  *only* failure.

Every substantive expectation — schemas, extensions, roles, public objects, RLS,
row counts, required tables, taxonomy state, integrity constraints and the
migration-history set — is identical between the two baselines. The fingerprint
mismatch is therefore an **algorithm-version artifact, not schema drift**. This
is asserted in `tests/restore-verification-contract.spec.js` against the
committed restored-copy matrix in
`tests/fixtures/restore-verification-matrix-40156618194.json`, so the
conclusion is reproducible in CI rather than resting on a one-off comparison.

Because of this, the workflow's default `baseline_manifest` is the current
baseline. Pointing it at the superseded baseline would make every future
restore verification fail on the fingerprint alone and mask genuine drift.
`diagnostics.historical_20261018_fingerprint` preserves the old value for audit
without making it the comparison target.

If the normalisation in `scripts/sql/restore-verification-matrix.sql` changes
again, the recorded fingerprint will no longer match a freshly restored copy
and a new baseline must be captured. The contract test guards both normalisation
markers so that change cannot pass unnoticed.

## 4. Informational output (never fails the run)

`canonical_repository_drift` reports how the backup's migration list compares with
the canonical repository baseline (for example: backup 105 vs canonical 106,
missing `20261013190000_retire_external_certification_taxonomy.sql`).

This is deliberately informational. The `staging migration parity` job in
`.github/workflows/supabase-migration-drift.yml` owns that decision, and must not
be disabled to make this job pass.

## 5. Baseline provenance and the "counts may have moved" rule

The baseline is captured from the backup's own contents, not from live staging at
verification time. Row counts are therefore immutable expectations for the
restored copy. Re-deriving expectations from live staging would silently accept a
partial restore whenever staging had changed since the backup was taken.

Detecting post-backup staging drift is a separate concern and must not be folded
into this check.

## 6. Failure semantics

* Any failed check → `RESTORE VERIFICATION: FAIL`, exit code 1, job fails.
* `pg_restore` keeps `--exit-on-error`; restore errors are never suppressed and a
  partial restore is never reported as verified.
* Verification never writes to staging, production, or the restored database.

## 7. Reproducing locally

```bash
# 1. Produce a matrix from any database (read-only)
psql "$DATABASE_URL" -At -f scripts/sql/restore-verification-matrix.sql > matrix.json

# 2. Compare it against the recorded baseline
node scripts/verify-restore-baseline.js \
  --matrix matrix.json \
  --baseline docs/database/staging-restore-baseline-40034471907.json \
  --report restore-verification-report.json
```

To record a baseline for a new backup, run the matrix SQL against staging
read-only immediately after the backup completes and store the values under
`expectations`, together with the artifact digest from the backup run.

When recording a new baseline, also record the current
`expectations.schema_fingerprint` **and** the per-category digests from
`schema_component_fingerprints`, and carry the previous baseline's fingerprint
into `diagnostics.historical_20261018_fingerprint`. See §3.2 for why the
fingerprint is version-bound and why that audit trail is required.
