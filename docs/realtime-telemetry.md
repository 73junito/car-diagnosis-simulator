## CI Compatibility Notes

The telemetry POST handler now uses route-scoped `express.json({ limit: "10kb" })` and `req.body` instead of manually reading the request stream.

This avoids test/runtime compatibility issues in CI environments where request body streams, `TextDecoder`, or raw stream handling may behave differently across Node/JSDOM/Jest contexts.

Expected behavior:
- Valid telemetry POST payloads are read from `req.body`.
- Invalid payloads return `400`.
- JSON parsing remains scoped to the telemetry event route.
- SSE streaming remains separate from POST ingestion.

Persistent storage scaffold

Planned migration and storage adapter files live under `db/migrations` and `api/telemetry/storage.js`.
The initial migration will create a `telemetry_events` table with indexes on `session_id` and `created_at`.
The storage adapter uses Supabase when `SUPABASE_URL` and a service key are present and otherwise fails gracefully.
Export endpoints

- `GET /api/telemetry/export.json` — server-side export (JSON) with optional `session` and `limit` query params. Default `limit=50`, hard max `500`.
- `GET /api/telemetry/export.csv` — server-side CSV export. Columns: `id,session_id,user_id,event_type,source,created_at,payload_json`.

Both endpoints return newest-first results from the configured storage adapter. When storage is not configured, `GET /api/telemetry/export.json` responds with `{ ok: false, format: 'json', count: 0, events: [] }` (and may include a `message`), while `GET /api/telemetry/export.csv` returns only the CSV header row.
# Realtime Telemetry (SSE)

This document describes the lightweight Server-Sent Events (SSE) telemetry scaffolding.

Endpoints

- `GET /api/telemetry/stream` — SSE stream; clients connect with `EventSource`.
- `POST /api/telemetry/events` — Accepts JSON payloads and broadcasts to connected clients (in-memory).

Client

Use the provided client helper in `dashboard/live-telemetry.js`:

```js
const live = liveTelemetry.initLiveTelemetry((evt) => {
  // handle telemetry event
});

// stop:
live.close();
```

Notes

- This is scaffolding only: no auth, no persistence. Events are broadcast in-memory.
- Server `EventEmitter` is used for demo and testing purposes. For production, replace with a robust pub/sub or streaming backend.

Auth integration (scaffold)

- The repo includes a lightweight scaffold for resolving actor role information used by the telemetry access gate.
- `api/auth/role.js` resolves a best-effort `{ role, userId, source }` from request headers (e.g. `x-torquemind-role`) and marks when an `Authorization` header is present. It does NOT verify tokens — token verification will be implemented in a follow-up PR.
- `api/telemetry/access.js` uses `resolveUserRole(req)` and emits richer audit events containing `userId`, `role`, `source`, and `allowed`.

This scaffold is intentionally minimal to allow integration testing and to avoid embedding secrets or provider-specific logic in the repository. The next step is to integrate with a real auth provider and add production-ready checks.

Supabase token verification (scaffold)

- If `SUPABASE_URL` and `SUPABASE_ANON_KEY` are present in the environment, the server will attempt to verify `Authorization: Bearer <token>` using Supabase's JS client.
- The verifier is implemented in `api/auth/supabase-token.js` and used by `api/auth/role.js`. When verification succeeds, audit events include `userId`, `role`, and `source: "supabase"`.
- If the env vars are missing or verification fails, the system falls back to the lightweight header-based check (`x-torquemind-role`).
- Tests mock the Supabase client to avoid network calls.
- The repository also supports an explicit mode via `TORQUEMIND_AUTH_MODE`:
  - `demo` (default): keeps header fallback when no Supabase config is present.
  - `supabase`: strict mode — token verification is required when `Authorization` is present and missing/invalid credentials will deny access.
  - See `docs/supabase-auth.md` for full guidance on configuration, Vercel env setup, and testing.
