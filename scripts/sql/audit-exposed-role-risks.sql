-- Read-only authorization risk inventory. Run under an administrator role.
-- Reports broad SELECT policies and grants which are not constrained by RLS.
WITH exposed_tables AS (
 SELECT c.oid, n.nspname, c.relname, c.relrowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
), findings AS (
 SELECT 'BROWSER_TRUNCATE' AS finding, nspname AS schema_name, relname AS object_name,
        'anon' AS role_name, 'TRUNCATE bypasses RLS' AS detail
 FROM exposed_tables WHERE has_table_privilege('anon',oid,'TRUNCATE')
 UNION ALL
 SELECT 'BROWSER_TRUNCATE', nspname,relname,'authenticated','TRUNCATE bypasses RLS'
 FROM exposed_tables WHERE has_table_privilege('authenticated',oid,'TRUNCATE')
 UNION ALL
 SELECT 'PUBLIC_TABLE_WITHOUT_RLS',nspname,relname,'anon/authenticated','RLS disabled'
 FROM exposed_tables WHERE NOT relrowsecurity
 UNION ALL
 SELECT 'BROAD_AUTHENTICATED_SELECT',schemaname,tablename,'authenticated',
        policyname || ': ' || coalesce(qual,'<null>')
 FROM pg_policies
 WHERE schemaname='public' AND cmd IN ('SELECT','ALL')
   AND permissive='PERMISSIVE'
   AND (roles && ARRAY['authenticated','public']::name[])
   AND coalesce(trim(qual),'') IN ('true','(true)')
)
SELECT * FROM findings ORDER BY finding,schema_name,object_name,role_name;
