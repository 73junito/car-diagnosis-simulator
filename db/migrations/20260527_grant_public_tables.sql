-- Migration: Grant Data API privileges for existing public tables
-- Date: 2026-05-27
-- Purpose: Ensure tables are explicitly exposed to the Data API (PostgREST/GraphQL/supabase-js)

-- Grant schema usage so roles can reference objects in public
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant table-level privileges
-- Minimal principle: only give authenticated role full CRUD. Avoid granting write to anon.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.replays TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.completions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.classes TO authenticated;

-- Profiles are sensitive: allow authenticated users to SELECT their own via RLS, but grant SELECT
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- Optional legacy/lookup tables (read-only for clients). Grant SELECT to anon if these are safe to expose.
-- Uncomment the next lines if these tables are intended to be readable by unauthenticated clients.
-- GRANT SELECT ON TABLE public.some_public_lookup TO anon;

-- Grant sequence usage for serial/bigserial PKs to authenticated (and anon if needed)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- If you must expose sequences to the public client (not recommended), uncomment:
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- OPTIONAL: Revoke default privileges to emulate new-project behavior for future tables
-- (useful for local dev and CI to match Oct 30, 2026 behavior). Uncomment if you want to
-- prevent new tables from inheriting grants in dev environments.
--
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--   REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role;
--
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--   REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated, service_role;

-- End of migration
