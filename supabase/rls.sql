-- LEGACY REFERENCE ONLY - DO NOT APPLY TO ANY DATABASE.
-- This file contains deprecated auth.role() policies and is not part
-- of the Supabase migration chain. Ownership-based RLS must be delivered
-- through a separately reviewed and behaviorally verified migration.
--
-- Historical comment:
-- RLS policies for Car Diagnosis Simulator
-- Apply these after running supabase/schema.sql

-- telemetry_events: allow client (anon) INSERTs but no SELECT/UPDATE/DELETE
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous clients (anon key) to INSERT telemetry events
CREATE POLICY allow_anon_insert ON telemetry_events
  FOR INSERT
  TO anon
  USING (auth.role() = 'anon')
  WITH CHECK (payload IS NOT NULL);

-- Disallow anonymous SELECTs — only authenticated users or the service role may read
CREATE POLICY allow_authenticated_select ON telemetry_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- session_history: server-only access (no client-side direct access)
ALTER TABLE session_history ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated users (or service role) to INSERT/SELECT (clients should use Edge Functions)
CREATE POLICY sessionhistory_server_only ON session_history
  FOR ALL
  USING (auth.role() = 'authenticated');

-- scenarios: public read, server-only write
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public) to SELECT scenarios
CREATE POLICY scenarios_public_select ON scenarios
  FOR SELECT
  USING (true);

-- Allow only authenticated users to INSERT/UPDATE/DELETE scenarios
CREATE POLICY scenarios_authenticated_mods ON scenarios
  FOR INSERT, UPDATE, DELETE
  USING (auth.role() = 'authenticated');

-- diagnosis_steps: read by public, write by authenticated
ALTER TABLE diagnosis_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY steps_public_select ON diagnosis_steps
  FOR SELECT
  USING (true);
CREATE POLICY steps_authenticated_mods ON diagnosis_steps
  FOR INSERT, UPDATE, DELETE
  USING (auth.role() = 'authenticated');

-- analytics tables: server-only (no client access)
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_server_only ON analytics_daily
  FOR ALL
  USING (auth.role() = 'authenticated');

ALTER TABLE analytics_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_students_server_only ON analytics_students
  FOR ALL
  USING (auth.role() = 'authenticated');

-- users table: authenticated users can select/modify their own record
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self_select ON users
  FOR SELECT
  USING (auth.uid() = id::text OR auth.role() = 'authenticated');
CREATE POLICY users_self_mod ON users
  FOR UPDATE, DELETE
  USING (auth.uid() = id::text);
CREATE POLICY users_public_insert ON users
  FOR INSERT
  USING (true)
  WITH CHECK (anonymous = true OR auth.role() = 'authenticated');

-- Notes:
-- 1) The "service_role" key bypasses RLS; use it only in secure server environments (Edge Functions or backend).
-- 2) For more granular policies, tie inserts to JWT claims (e.g., check for a "can_insert_telemetry" claim).
-- 3) Consider using Supabase Edge Functions as a secure write-proxy for session_history and other server-only tables.
