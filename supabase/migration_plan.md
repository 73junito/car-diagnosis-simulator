Supabase migration plan — telemetry adapter migration

Goal
----
Migrate from in-memory telemetry to Supabase-backed storage with minimal service disruption and safe rollback.

Assumptions
-----------
- `supabase/schema.sql` has been applied to the target project.
- Row-level security (RLS) policies are pending implementation in a dedicated security PR. Until then, standard Postgres roles provide access control.
- The app currently uses `lib/telemetry/inMemoryAdapter.js` and `lib/telemetry/index.js` facade.

High-level strategy
-------------------
1. Deploy DB schema and RLS in a staging Supabase project.
2. Add a Supabase adapter implementation alongside the in-memory adapter.
3. Implement a phased rollout: client-side batching + dual-write (in-memory + Supabase) behind a feature flag.
4. Monitor for errors and performance; flip to Supabase-only when stable.
5. Remove the in-memory persistence and feature flag after verification.

Step-by-step plan
------------------
1) Prepare Supabase and apply schema
   - Open Supabase project -> SQL Editor
   - Run `supabase/schema.sql`
   - NOTE: RLS policies will be applied in a separate verified migration (pending in a dedicated security PR)
   - Create a test dataset (insert a scenario and a couple of telemetry events)

2) Add Supabase adapter (server-side)
   - Create `lib/telemetry/supabaseAdapter.js` that exposes the same API as other adapters: `saveEvent(event)`, `listEvents(opts)`, `getRecentEvents()` and `streamEmitter` (if needed).
   - Use the Supabase JS client with the service role key on server endpoints (Edge Functions or server environment). Example pattern:

```js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function saveEvent(ev) {
  return supabase.from('telemetry_events').insert(ev);
}
```

3) Dual-write mode behind feature flag
   - Add config env `TELEMETRY_BACKEND=dual|inmemory|supabase` (default `inmemory`)
   - In the facade `lib/telemetry/index.js`, add logic to write to both adapters when `dual`.
   - Clients continue sending events unchanged.

4) Client-side batching
   - Implement light client batching (buffer events in memory, flush every 2s or when buffer hits 50 events).
   - Send batched payloads to `/api/telemetry/events/batch` (server route that expands and calls `saveEvent` per event or batch insert).
   - This reduces write pressure on Supabase and keeps bandwidth efficient.

5) Testing in staging
   - Deploy the app to a staging environment with `TELEMETRY_BACKEND=dual` and SUPABASE keys pointing to staging DB.
   - Verify events appear in `telemetry_events` and that read queries work.
   - Verify RLS policies block unauthorized reads from client (try selecting from browser).

6) Gradual rollout to production
   - Flip `TELEMETRY_BACKEND` to `supabase` in a controlled window.
   - Monitor errors, insertion latency, and DB slow queries.
   - If issues are detected, roll back to `dual` or `inmemory` by toggling env.

7) Cleanup
   - After 48–72 hours of stable production monitoring, remove `inMemoryAdapter` or keep it for local dev only.
   - Optionally migrate old JSON-based analytics loaders to query Supabase aggregates instead.

Testing & validation
---------------------
- Unit tests for `supabaseAdapter` mocking `@supabase/supabase-js`.
- Integration test in staging: send batch events and confirm `telemetry_events` inserts.
- Security check: validate RLS policies block client read.
- Load test: simulate expected event rate (use a small script) and observe DB metrics.

Rollback plan
--------------
- If Supabase shows errors (failed inserts, high latency), revert `TELEMETRY_BACKEND` env to `dual` or `inmemory` immediately.
- If RLS misconfiguration blocks legitimate server access, apply fix in SQL and re-run migration for that policy.

Operational notes
------------------
- Use the Supabase service role key only in server contexts (Edge Functions, serverless API routes). Do not embed it in client code.
- Consider partitioning `telemetry_events` by date once volume grows (monthly/yearly partitions).
- Add background job (Edge Function or CRON) to compute `analytics_daily` periodically.

Commands & snippets
--------------------
Apply schema in psql:

```bash
psql "postgresql://postgres:<password>@<host>:5432/postgres" -f supabase/schema.sql
```

Note: RLS policies will be applied through a verified Supabase migration in a dedicated security PR (pending).

Smoke test with Node:

```js
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async ()=>{
  const { data, error } = await sb.from('telemetry_events').insert([{ type: 'smoke', payload: { ok: true } }]);
  console.log('insert', { data, error });
})();
```


