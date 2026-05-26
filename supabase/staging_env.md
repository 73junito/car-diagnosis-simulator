Staging environment example — Supabase telemetry

Set these env vars in your staging environment (Supabase Functions and app):

- SUPABASE_URL=https://your-project.supabase.co
- SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # keep secret, only in server envs
- SUPABASE_ANON_KEY=<anon-key>                  # for client reads only
- TELEMETRY_INGEST_URL=https://<FUNCTION_URL>/insert_telemetry_batch
- TELEMETRY_BACKEND=supabase
- SUPABASE_FLUSH_MS=2000
- SUPABASE_FLUSH_SIZE=50
- SUPABASE_MAX_RETRIES=3

Deployment steps (high level):

1. Deploy Edge Functions to Supabase (see `supabase/functions/README.md`).
2. Apply `supabase/schema.sql` and `supabase/rls.sql` in staging DB.
3. Set the staging env vars above in your app and in Functions secrets.
4. Start app with `TELEMETRY_BACKEND=supabase` and monitor inserts.

Testing tips:
- Start in `dual` mode (if implemented) to write both in-memory and supabase.
- Use sample `curl` command to POST a small batch to `TELEMETRY_INGEST_URL` and verify data appears in `telemetry_events`.

Rollback:
- Flip `TELEMETRY_BACKEND` back to `inmemory` or set `TELEMETRY_INGEST_URL` to empty.

Security note:
- Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. Keep it only in server/function envs.
