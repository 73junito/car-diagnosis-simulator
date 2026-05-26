# Supabase Performance Tuning Checklist — Telemetry Pipeline

This checklist helps you tune ingestion, batching, retries, RLS, and analytics performance across the full Supabase telemetry stack.

## 1. Database Performance
- Enable connection pooling (PgBouncer) for high‑frequency inserts
- Check row size + JSONB usage — large payloads slow down WAL
- Add appropriate indexes: `event_time`, `session_id`, `scenario_id`
- Partition large tables when events exceed ~5–10M rows
- Monitor RLS performance — complex policies can slow inserts
- Tune autovacuum for heavy‑write tables

## 2. Edge Function Performance
- Use streaming inserts for large batches when supported
- Avoid synchronous loops — use `Promise.all` where safe
- Set function timeout appropriately for expected batch sizes
- Cache metadata (scenario lookups, config) when safe
- Return early on validation failure to avoid wasted work

## 3. Telemetry Adapter (Client‑Side)
- Tune batch size (start with 20–50 events)
- Tune flush interval (1–3 seconds typical)
- Enable exponential backoff with max retries
- Cap retry queue length to prevent unbounded memory growth
- Log dropped batches and expose metrics for observability

## 4. Network & API Layer
- Use a dedicated ingest URL (Edge Function) for telemetry
- Enable gzip or brotli compression for payloads
- Avoid sending redundant fields; keep events compact
- Use POST only — do not rely on GET for telemetry

## 5. RLS & Security
- Simplify RLS policies; avoid arbitrary subqueries in per‑row checks
- Use the service role key only in Edge Functions or server systems
- Ensure anon key cannot perform writes that should be server‑only
- Validate payload shape server‑side and fail fast on malformed data

## 6. Analytics Performance
- Pre‑aggregate daily analytics into `analytics_daily` or materialized views
- Use materialized views for heavy read patterns and refresh on schedule
- Schedule refresh jobs and avoid on‑demand full scans of raw events
- Index analytics tables used by dashboards

## 7. Monitoring & Observability
- Enable Supabase function and DB logs retention and centralize logs
- Monitor WAL volume and DB write throughput
- Track ingestion latency (client → function → DB)
- Alert on RLS violations, high error rates, and function failures

## 8. Load Testing
- Simulate high‑volume sessions and concurrent batches
- Test adapter flush behavior under stress (bursting clients)
- Measure Supabase insert throughput and WAL impact
- Test RLS performance and function behavior under load

## 9. Production Hardening
- Add rate limiting and request quotas for public ingestion endpoints
- Use retries with jitter and exponential backoff
- Add a dead‑letter queue for permanently failing batches
- Consider row‑level TTL / archival for raw events
- Document rollback and recovery procedures for the DB and functions

## 10. Go‑Live Quick Checklist
- Staging stable for 24–48 hours with no critical errors
- No persistent RLS violations
- Ingest error rate within acceptable thresholds
- Analytics jobs running and aggregations verified
- Monitoring alerts configured and validated

---

Files & commands referenced
- `supabase/schema.sql`, `supabase/rls.sql`
- `lib/telemetry/supabaseAdapter.js`
- `supabase functions deploy <name>`
