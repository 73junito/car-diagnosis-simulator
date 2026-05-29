-- Grants audit: list objects in public schema missing required Data API privileges
-- Outputs rows: object_type, object_schema, object_name, missing_for

-- Tables missing SELECT for `authenticated`
SELECT 'table' AS object_type, table_schema AS object_schema, table_name AS object_name, 'authenticated' AS missing_for
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'authenticated')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema = t.table_schema
      AND g.table_name = t.table_name
      AND g.grantee = 'authenticated'
      AND g.privilege_type = 'SELECT'
  );

-- Tables missing SELECT for `anon` (public-read)
SELECT 'table' AS object_type, table_schema AS object_schema, table_name AS object_name, 'anon' AS missing_for
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'anon')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema = t.table_schema
      AND g.table_name = t.table_name
      AND g.grantee = 'anon'
      AND g.privilege_type = 'SELECT'
  );

-- Sequences missing USAGE for `authenticated`
SELECT 'sequence' AS object_type, n.nspname AS object_schema, c.relname AS object_name, 'authenticated' AS missing_for
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relkind = 'S'
  AND n.nspname = 'public'
  AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'authenticated')
  AND NOT has_sequence_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'USAGE');
