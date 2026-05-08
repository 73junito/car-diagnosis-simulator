# TorqueMind API (Express + Supabase)

This folder contains a minimal Express-based backend scaffold for the TorqueMind app, using Supabase (Postgres) for persistence.

Quick start

1. Copy `.env.example` to `.env` and fill values:

```
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
```

2. Install dependencies:

```bash
cd torquemind-api
npm install
```

3. Run the server:

```bash
npm start
```

Available endpoints
- `POST /api/replay` — save replay
- `POST /api/assign` — create an assignment
- `POST /api/complete` — record completion

## Smoke Test

```bash
npm install
npm start
npm run test:smoke
```

CI: a lightweight GitHub Actions workflow is included at `.github/workflows/api-smoke.yml` which:

- checks out the repo
- installs dependencies for the API
- starts the server in the background
- waits briefly and runs `npm run test:smoke`

Notes:
- The smoke test uses the local fallback (no Supabase service key) so it can run in CI without secrets. If you want the CI to run against a real Supabase project, we can add secure secrets and extend the test to authenticate.
- The smoke test requires Node 18+ (global `fetch`).
  - body: `{ userId, scenarioId }`

Notes

- This scaffold expects you to create tables in Supabase. Use `db/schema.sql` as a starting point in the Supabase SQL editor.
- The `@supabase/supabase-js` client is used for simple read/insert operations. For production, add authentication checks, role validation, and input validation.
- After starting, update your frontend to replace localStorage calls with the API. Example: fetch teacher data from `/api/teacher/data` instead of reading `localStorage`.

Next steps I can implement for you (pick one):

- Add authentication integration (Supabase auth) and example protected endpoints.
- Replace current frontend `localStorage` calls with API calls and wire sign-in flows.
- Add endpoint tests and CI configuration.

## DB SSL validation helper

A small local-only helper validates your PostgreSQL SSL settings and optionally connects to the database.

Usage

1. Create a `.env` in `torquemind-api/` (copy `.env.example`) and set these values:

```
PGHOST=db.your-project.supabase.co
PGPORT=5432
PGDATABASE=postgres
PGUSER=postgres
PGPASSWORD=your_password
PGSSLMODE=verify-full
PGSSLROOTCERT=C:\\Users\\rod63\\Downloads\\prod-ca-2021.crt
```

2. Run the validator in dry-run mode (no DB connection):

```powershell
cd torquemind-api
npm run db:validate -- --dry-run
```

The dry-run checks that env vars are loaded, the CA path (if provided) exists, and prints SSL mode diagnostics.

3. Run the full validation (will attempt a DB connection):

```powershell
npm run db:validate
```

Notes

- Do not commit your private CA or DB password into the repository.
- The script reads `PGSSLROOTCERT` from your local path; keep `prod-ca-2021.crt` locally (e.g. `C:\Users\rod63\Downloads`).
- If you need the script to attempt policy validation against `db/classroom_policies.sql`, place that file in `torquemind-api/db/` and run the full validation; the script will preview the SQL and provide guidance (it will not modify DB schema automatically).

### PowerShell wrapper (Windows)

There is a PowerShell wrapper that loads `.env`, checks the CA file, runs the dry-run diagnostics, and then runs the full validation if you confirm:

```powershell
.\scripts\validate-db-ssl.ps1
```

It will copy `.env.example` to `.env` if a `.env` is not present and prompt you to edit it before proceeding.

## Manual DB SSL Validation Workflow

A manual GitHub Actions workflow is available:

`.github/workflows/db-ssl-validation.yml`

To run it:
1. Go to GitHub → Actions.
2. Select **DB SSL Validation**.
3. Click **Run workflow**.
4. Set `run-db-ssl` to `true`.
5. Download the artifact: `db-ssl-validation-report`.

Required GitHub secrets when ready:
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSLMODE`
- `PGSSLROOTCERT` or a secure way to provide the CA certificate

Do not commit `.env` or private credentials.

