## Summary

Adds the initial persisted telemetry storage scaffold for TorqueMind telemetry analytics.

## Included

* Supabase-ready telemetry storage adapter
* SQL migration for `telemetry_events`
* Mocked storage integration tests
* Persistent telemetry documentation updates

## Files

* `db/migrations/001_create_telemetry_events.sql`
* `api/telemetry/storage.js`
* `tests/telemetry-storage.test.js`
* `docs/realtime-telemetry.md`

## Storage Adapter API

```js
saveTelemetryEvent(event)
listTelemetryEvents({ sessionId, limit })
```

## Notes

* Uses Supabase only when environment variables are configured.
* Fails gracefully when Supabase is unavailable.
* Tests mock Supabase clients only — no network calls or secrets.

## Follow-up Work

* `/api/telemetry/history`
* session replay endpoint
* instructor session-history UI
* CSV/JSON export
* retention cleanup job
* pagination/filtering
