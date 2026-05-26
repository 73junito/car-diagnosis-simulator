# New‑Hire Checklist — Telemetry Pipeline (Supabase)

This checklist is a task‑oriented runbook for a new engineer to get productive with the telemetry pipeline in one session.

1. Setup repository
   - git clone https://github.com/73junito/car-diagnosis-simulator
   - cd car-diagnosis-simulator
   - npm install

2. Confirm local dev works
   - npm run dev
   - Open the simulator and trigger a small event (use UI scenario)
   - Verify events appear in console / local logs

3. Run analytics unit tests
   - npx jest tests/analytics --runInBand
   - Confirm tests pass

4. Read onboarding docs
   - Review `docs/onboarding/telemetry-quickstart.md`
   - View architecture diagram in the PR or `docs/` (Mermaid)

5. Prep staging Supabase (with owner or infra)
   - Ensure staging Supabase project exists
   - Obtain `SUPABASE_SERVICE_ROLE_KEY` (store securely)
   - Confirm `SUPABASE_URL`

6. Apply schema & RLS in staging
   - Open Supabase SQL editor
   - Run `supabase/schema.sql` then `supabase/rls.sql`
   - Confirm `telemetry_events` and `session_history` exist

7. Deploy Edge Functions
   - supabase functions deploy insert_telemetry_batch
   - supabase functions deploy get_daily_analytics
   - supabase functions deploy get_session_history
   - Set function secrets: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`

8. Configure staging environment variables
   - TELEMETRY_BACKEND=supabase
   - SUPABASE_URL=...
   - SUPABASE_ANON_KEY=...
   - SUPABASE_SERVICE_ROLE_KEY=...
   - TELEMETRY_INGEST_URL=(Edge Function URL, optional)

9. Run staging smoke test
   - POST a small telemetry batch (use the adapter or curl)
   - Verify the batch wrote rows to `telemetry_events`
   - Verify `session_history` entries for the session
   - Check Edge Function and DB logs for errors

10. Monitor and accept
   - Monitor function logs & DB for 24–48 hours
   - If stable, enable scheduled analytics jobs
   - Notify reviewers and update PR with verification notes

11. Security & cleanup
   - Never commit `SERVICE_ROLE_KEY` to repo
   - Confirm RLS policies restrict client writes appropriately
   - Rotate any test keys used for verification

Key references
- `lib/telemetry/supabaseAdapter.js`
- `lib/telemetry/index.js`
- `api/telemetry/stream.js`
- `supabase/schema.sql`, `supabase/rls.sql`
- `supabase/functions/*`
