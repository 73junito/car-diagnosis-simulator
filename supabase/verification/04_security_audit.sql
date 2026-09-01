-- Read-only security and schema drift audit.
SELECT
    namespace.nspname AS schema_name,
    relation.relname AS table_name,
    relation.relrowsecurity AS rls_enabled,
    relation.relforcerowsecurity AS force_rls
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p')
ORDER BY relation.relname;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
    'public.scenario_questions'::regclass,
    'public.question_provenance'::regclass,
    'public.source_chunks'::regclass
)
ORDER BY conrelid::regclass::text, conname;
