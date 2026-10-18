# Manual encrypted staging database backup

This workflow exports only staging project `jchfruprqpeypdttvlam` using the environment-scoped `STAGING_DB` connection string. No migrations or other remote writes are executed.

## Prerequisites

Add environment secret `STAGING_BACKUP_PASSPHRASE` to GitHub Settings → Environments → `jchfruprqpeypdttvlam_staging`. Generate a strong unique passphrase and preserve it in a secure location outside GitHub: it is required to restore the encrypted artifact. The existing `STAGING_DB` secret must contain a valid staging PostgreSQL connection URI, not a REST API URL. Never paste the secrets into workflow inputs, PR comments, or logs.

## Run

From GitHub Actions, select **Manual encrypted staging database backup**, Run workflow, and type `BACKUP-STAGING`. The job checks the staging project reference in the URI, connects with PostgreSQL 17, performs a read-only logical dump, checks archive readability, encrypts the dump with AES-256, and verifies that decryption matches the original dump bytes. Only ciphertext and its SHA-256 checksum are uploaded as an artifact, retained for one day.

Download the artifact promptly and preserve it in secure, access-controlled backup storage.

## Restore verification

Passing this workflow does **not** establish restorable recovery. Verify the downloaded ciphertext checksum, decrypt on a trusted machine, restore to a **new disposable PostgreSQL 17 database** (never the existing local Docker database), and check row counts, migration history, schema, dependent objects, and app queries. Document the restoration test in PR #1063 before considering the historical migration.

The dump uses `--no-owner --no-acl`; cluster-global roles, ownership, and grants require separate recovery planning. A successful archive-list check is not a restore test. Do not merge PR #1063 merely because this backup job succeeded.
