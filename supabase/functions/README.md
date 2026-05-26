Supabase Edge Function scaffolds for Car Diagnosis Simulator

Functions:

- insert_telemetry_batch: Accepts POST { events: [...] } and inserts into `telemetry_events` and `session_history`.
- get_daily_analytics: Computes daily aggregates and upserts into `analytics_daily`.
- get_session_history: Returns ordered `session_history` entries for a `session_id`.

Environment variables (set in Supabase Functions settings):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (service role — keep secret)

Usage examples (curl):

Insert batch:

```bash
curl -X POST "https://<FUNCTION_URL>/insert_telemetry_batch" -H "Content-Type: application/json" -d '{"events": [{"type":"action","session_id":"s1","payload":{"confidence":0.8}}]}'
```

Get session history:

```bash
curl "https://<FUNCTION_URL>/get_session_history?session_id=s1"
```

Compute today's analytics:

```bash
curl "https://<FUNCTION_URL>/get_daily_analytics?date=2026-05-25"
```
