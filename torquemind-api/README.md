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

