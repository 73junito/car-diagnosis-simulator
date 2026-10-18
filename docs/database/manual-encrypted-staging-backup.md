# Manual encrypted staging database backup

The GitHub Actions workflow exports project `jchfruprqpeypdttvlam` using the **Supabase Session Pooler**, not the direct database endpoint.

## Staging GitHub environment configuration

Settings → Environments → `jchfruprqpeypdttvlam_staging`:

- **Secret** `STAGING_DB`: existing database **password only**. Do not replace it with a URL.
- **Secret** `STAGING_BACKUP_PASSPHRASE`: strong independent encryption passphrase. Safeguard it outside GitHub.
- **Variable** `STAGING_DB_HOST`: exact Session Pooler hostname copied from Supabase Connect (must end `.pooler.supabase.com`).
- **Variable** `STAGING_DB_USER`: `postgres.jchfruprqpeypdttvlam`.
- **Variable** `STAGING_DB_PORT`: `5432` (Session mode, not transaction mode).
- **Variable** `STAGING_DB_NAME`: `postgres`.

These variables contain no database password. The workflow rejects unexpected user/project identifier, pooler hostname, port and database before connecting. TLS is required by `PGSSLMODE=require`. Hostname identity is validated by the configured pooler host and tenant-scoped username, not a database-side identity attestation.

Run GitHub Actions → **Manual encrypted staging database backup** → **Run workflow**; enter `BACKUP-STAGING`. The read-only PostgreSQL 17 dump is encrypted using AES-256 and checked by decrypting and comparing bytes. Only encrypted data and SHA-256 checksum are uploaded, with **one-day** artifact retention.

**A successful workflow is not a validated restoration.** Download promptly to secure independent storage; verify checksum, decrypt on a trusted machine, restore into a new disposable PostgreSQL 17 database, and compare data, schema, migrations, and application queries before unblocking PR #1063.

The `--no-owner --no-acl` logical dump does not fully preserve database-global roles and permissions. Never expose passwords in issue comments or logs.
