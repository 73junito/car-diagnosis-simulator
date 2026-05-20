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
