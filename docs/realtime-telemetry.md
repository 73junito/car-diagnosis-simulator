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
