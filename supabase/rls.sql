-- Idempotent, ownership-enforcing RLS for optional analytics tables.
BEGIN;

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.telemetry_events, public.session_history,
    public.analytics_daily, public.analytics_students, public.users FROM anon;

-- ============================================================================
-- telemetry_events: User ownership enforcement
-- ============================================================================
DROP POLICY IF EXISTS telemetry_owner_select ON public.telemetry_events;
DROP POLICY IF EXISTS telemetry_owner_insert ON public.telemetry_events;
CREATE POLICY telemetry_owner_select ON public.telemetry_events
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY telemetry_owner_insert ON public.telemetry_events
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id AND payload IS NOT NULL);

-- ============================================================================
-- session_history: User ownership enforcement
-- ============================================================================
DROP POLICY IF EXISTS session_history_owner_select ON public.session_history;
DROP POLICY IF EXISTS session_history_owner_insert ON public.session_history;
CREATE POLICY session_history_owner_select ON public.session_history
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY session_history_owner_insert ON public.session_history
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- scenarios: Public read, server-only write
-- ============================================================================
DROP POLICY IF EXISTS scenarios_public_select ON public.scenarios;
CREATE POLICY scenarios_public_select ON public.scenarios
    FOR SELECT USING (true);

-- ============================================================================
-- diagnosis_steps: Public read, server-only write
-- ============================================================================
DROP POLICY IF EXISTS steps_public_select ON public.diagnosis_steps;
CREATE POLICY steps_public_select ON public.diagnosis_steps
    FOR SELECT USING (true);

-- ============================================================================
-- analytics_daily: Server-only (no client access)
-- ============================================================================
DROP POLICY IF EXISTS analytics_daily_authenticated ON public.analytics_daily;
CREATE POLICY analytics_daily_authenticated ON public.analytics_daily
    FOR SELECT TO service_role USING (true);

-- ============================================================================
-- analytics_students: Server-only (no client access)
-- ============================================================================
DROP POLICY IF EXISTS analytics_students_authenticated ON public.analytics_students;
CREATE POLICY analytics_students_authenticated ON public.analytics_students
    FOR SELECT TO service_role USING (true);

-- ============================================================================
-- users: User-aware self-select with WITH CHECK
-- ============================================================================
DROP POLICY IF EXISTS users_owner_select ON public.users;
DROP POLICY IF EXISTS users_owner_insert ON public.users;
DROP POLICY IF EXISTS users_owner_update ON public.users;
CREATE POLICY users_owner_select ON public.users
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY users_owner_insert ON public.users
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY users_owner_update ON public.users
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

COMMIT;
