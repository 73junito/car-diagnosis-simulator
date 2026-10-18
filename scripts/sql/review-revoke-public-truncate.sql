-- REVIEW-ONLY, NOT A MIGRATION. Apply through a generated migration after DBA approval.
-- PostgreSQL TRUNCATE bypasses row-level security; these privileges are not needed by browser roles.
-- Restrict to two application roles and public-schema base tables. No data changes.
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname, c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND (has_table_privilege('anon',c.oid,'TRUNCATE')
        OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE %I.%I FROM anon, authenticated',rec.nspname,rec.relname);
  END LOOP;
END $$;
-- Assignments: validated broad policy. Scoped select policies already exist.
-- Remove only after separate cross-class access test and app owner sign-off:
-- DROP POLICY IF EXISTS assignments_read_authenticated ON public.assignments;
-- Postcondition:
-- SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE n.nspname='public' AND c.relkind IN ('r','p')
-- AND (has_table_privilege('anon',c.oid,'TRUNCATE') OR has_table_privilege('authenticated',c.oid,'TRUNCATE'));
