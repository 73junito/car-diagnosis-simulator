# Staging taxonomy schema probe (read-only)

Status: Gate A, local implementation. No workflow run has been executed and no staging connection has been made from this repository state.

## Purpose

PR #1084's `staging migration parity` job shows 106 canonical migrations against 105 recorded in staging, missing `20261013190000_retire_external_certification_taxonomy.sql`. A missing history row does not reveal the schema state, and existing automation can only read migration history through `app_migration_history()`. This probe closes that gap: it reports the structural schema facts needed to classify staging as unapplied, history-only, partially applied or indeterminate, without writing anything.

## Files

| File | Role |
| --- | --- |
| `scripts/sql/staging-taxonomy-schema-probe.sql` | Single read-only transaction, `statement_timeout` 20 s, emits JSONL sections (meta, history, relations, columns, constraints, indexes, rls, dependents, label counts) |
| `scripts/classify-staging-migration-state.js` | Merges the JSONL, refuses a non-read-only session, and reports one decision; exit 0 determinate, 1 indeterminate, 2 invalid output, 3 unsafe session |
| `tests/staging-migration-state-classifier.spec.js` | Deterministic tests for all classifications and failure conditions |
| `.github/workflows/staging-taxonomy-schema-probe.yml` | `workflow_dispatch` only, bound to `jchfruprqpeypdttvlam_staging` |

## Safety invariants

1. **No write path.** The SQL is wrapped in `begin read only; … commit;`, and the job exports `PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=20000'`. A closing `guard` section is emitted inside the transaction so the classifier can confirm the boundary held for the whole run. Any write attempt fails rather than proceeds.
2. **Authenticated TLS.** The connection uses `PGSSLMODE=verify-full` with an explicit CA (`PGSSLROOTCERT` written from the `STAGING_DB_CA_CERT` secret). Hostname-only encryption (`require`) is deliberately not used. If the CA secret is absent or holds no certificate, the job fails closed before connecting.
3. **No history edits, no migrations.** There is no `db push`, `db reset`, `migration repair`, `insert` or DDL anywhere in the workflow or SQL.
4. **Destination checked three times.** `assert-staging-supabase.js` validates `STAGING_URL`; a step validates the pooler host suffix, tenant-scoped user, port and database name; the classifier rejects any probe whose `meta.database` is not `postgres` or whose server version is unparseable or below 15.
5. **Credentials stay in the environment.** Only `vars` are read; the password and CA are used through `PGPASSWORD`/`PGSSLROOTCERT` and never printed. No connection string is constructed or logged.
6. **No content disclosure.** Only structural metadata and counts are returned: no question text, answer keys, label values or personal data. Label distribution is reported as null/labelled counts read through `query_to_xml`.
7. **No production access.** The workflow references only the staging environment and staging secrets; the production project is never named.
8. **No automatic triggers.** `workflow_dispatch` with a `confirm` input is the only trigger.
9. **No elevated role.** The probe runs as the existing staging pooler user. No role is created and no privilege is granted.
10. **Fail-closed classification.** The parser rejects malformed lines, duplicate sections and unexpected section names. All ten sections are required, so a partial probe exits `2` and can never be classified `unapplied` or `consistent`.
11. **No implicit permission.** A determinate classification returns exit `0`, but the JSON report carries `gateBEligible`, which is `true` only for `unapplied`. `--require-unapplied` turns any other determinate result into exit `1` for downstream automation.

## Prerequisites before Gate A-run

- `STAGING_DB_CA_CERT` must be added as a secret in the `jchfruprqpeypdttvlam_staging` environment, holding the CA certificate that signs the pooler endpoint.
- `STAGING_DB`, `STAGING_URL` secrets and the `STAGING_DB_HOST/USER/PORT/NAME` variables must already exist (they are also used by the backup workflow).
- A fresh restorable backup must exist for the run to be meaningful.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Deterministic classification (see `gateBEligible`; **not** permission to migrate) |
| 1 | Indeterminate, or `--require-unapplied` used with another outcome |
| 2 | Invalid or incomplete probe output (malformed, duplicate, unknown or missing section, wrong database, unusable version, bad types) |
| 3 | Unsafe session: `transaction_read_only` was not `on` in `meta` or `guard` |

## Execution procedure (Gate A, manual)

1. Confirm a fresh restorable backup exists for `jchfruprqpeypdttvlam` (see `docs/database/manual-encrypted-staging-backup.md`).
2. Actions → **Staging taxonomy schema probe (read-only)** → **Run workflow**, branch `main` (or the branch carrying this change), input `confirm` = `PROBE-STAGING`.
3. Wait for the environment's five-minute protection timer; the job then runs for well under a minute.
4. Download the `staging-taxonomy-probe-<run id>` artifact (`probe.jsonl`, `probe-report.json`, retained three days).
5. Record the decision and evidence in the PR or issue that tracks the staging recovery. Do not act on the database from this workflow.

## Decision table

| Decision | Evidence | Meaning | Gate B eligible | Permitted next step |
| --- | --- | --- | --- | --- |
| `unapplied` | Version absent, legacy column on both tables, no diagnostic column | Canonical migration never applied | **yes** | Gate B: rehearse the unchanged SQL on a data-equivalent clone |
| `history_only` | Version absent, diagnostic column on both tables, no legacy column | Schema already migrated, history row missing | no | **No** history insert. Requires evidence of the original application or an explicit owner decision |
| `partially_applied` | Legacy and diagnostic columns coexist, or only one table shows either column | Interrupted or partial change | no | Stop. Forward-only corrective migration and an owner decision |
| `indeterminate` | Neither column found, or history disagrees with the schema | Classification impossible | no | Stop and escalate with the artifact |
| `consistent` | Version present and diagnostic column on both tables | Healthy | no | None |

## What this gate does not do

- It does not apply, repair or record any migration.
- It does not replace the disposable-clone rehearsal (Gate B) or the controlled application (Gate C).
- It does not prove data equivalence; it reports structural facts and counts only.

## Interaction with existing controls

- `scripts/verify-supabase-migration-drift.js` and its workflow are untouched; the parity job remains failing until staging is reconciled.
- The trademark guard is untouched. The retired vendor token is assembled with string concatenation in both the SQL and the classifier, so neither file contains a contiguous identifier.
- The migration-integrity validator introduced by draft PR #1093 is not modified; this gate adds no migration file.
- `scripts/sql/staging-taxonomy-recovery-preflight.sql` (PR #1076, unmerged) remains the deeper pre-recovery probe; this workflow reuses its intent while adding constraints, indexes, RLS and dependent-relation reporting.
