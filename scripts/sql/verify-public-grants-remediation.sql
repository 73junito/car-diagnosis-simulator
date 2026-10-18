-- Read-only post-deployment verification for the scoped grant remediation.
-- Run separately on staging and production after approved migration deployment.
-- Empty results mean no exposed public base table retains TRUNCATE for browser roles.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       has_table_privilege('anon', c.oid, 'TRUNCATE') AS anon_truncate,
       has_table_privilege('authenticated', c.oid, 'TRUNCATE') AS authenticated_truncate
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND (
    has_table_privilege('anon', c.oid, 'TRUNCATE')
    OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
  )
ORDER BY c.relname;

-- Inspect effective policy definitions on assignments; any broad SELECT policy
-- such as USING (true) requires a separate security-approved replacement.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'assignments'
ORDER BY policyname;

-- Identify permissions granted directly on assignments.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'assignments'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
