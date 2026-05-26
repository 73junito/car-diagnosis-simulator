# Telemetry Quickstart — Supabase Telemetry Pipeline

Purpose: a single‑page runbook to get a contributor from clone → local dev → staging smoke tests → promote.

## 1) Clone & install
```bash
git clone https://github.com/73junito/car-diagnosis-simulator
cd car-diagnosis-simulator
npm install
npm run dev
```

Telemetry defaults to the in‑memory backend — no Supabase required.

## 2) Quick backend switch
- Local (default):
```bash
export TELEMETRY_BACKEND=memory
```
- Staging/Prod:
```bash
export TELEMETRY_BACKEND=supabase
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
export TELEMETRY_INGEST_URL=...   # optional Edge Function
```

## 3) Apply schema & RLS (Staging)
Open the Supabase SQL editor and run the files:

- `supabase/schema.sql`
- `supabase/rls.sql`

Confirm tables: `telemetry_events`, `session_history`, `analytics_daily`, `analytics_students`, `scenarios`, `diagnosis_steps`.

## 4) Deploy Edge Functions
```bash
supabase functions deploy insert_telemetry_batch
supabase functions deploy get_daily_analytics
supabase functions deploy get_session_history
```
Set secrets for functions: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

## 5) Staging smoke test (one small batch)
- POST a small telemetry batch to the ingest URL or use the app configured with `TELEMETRY_INGEST_URL`.
- Verify:
  - Row present in `telemetry_events`
  - `session_history` entries created as expected
  - Edge Function logs show no RLS or validation errors

## 6) Run analytics tests
```bash
npx jest tests/analytics --runInBand
```

## 7) Debug checklist (if smoke fails)
- Check adapter logs (flush/retry/backoff)
- Check Edge Function logs (Supabase dashboard)
- Confirm service role key present and not exposed to clients
- Verify RLS policy violations in DB logs

## 8) Key files & commands
- Adapter: `lib/telemetry/supabaseAdapter.js`
- Facade / stream: `lib/telemetry/index.js`, `api/telemetry/stream.js`
- Edge functions: `supabase/functions/*`
- Schema/RLS: `supabase/schema.sql`, `supabase/rls.sql`
- Tests: `tests/analytics/*`

## 9) Acceptance & promotion
- Monitor ingestion and function logs for 24–48 hours
- If stable, promote config to production and enable analytics jobs

## 10) Contacts & next steps
- Reviewer: paste PR verification comments and link to this quickstart and the architecture diagram
- Followups: performance tuning checklist, DOM‑XSS patch note

---

If you want this exported as a PDF or adjusted for printing, I can generate that next.
