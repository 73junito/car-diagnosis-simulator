-- Gate D: metadata-only security inventory. Do not use against production without approval.
-- Run with psql -X -v ON_ERROR_STOP=1 -f this-file on verified STAGING only.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '20s';
SELECT jsonb_build_object('kind','target','database',current_database(),
 'database_user',current_user,'read_only',current_setting('transaction_read_only'),
 'server_version',current_setting('server_version')) AS evidence;
SELECT jsonb_build_object('kind','table_acl','schema',n.nspname,'table',c.relname,
 'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'anon', (SELECT coalesce(jsonb_agg(a.privilege_type ORDER BY a.privilege_type),'[]'::jsonb)
 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a JOIN pg_roles gr ON gr.oid=a.grantee WHERE gr.rolname='anon'),
 'authenticated',(SELECT coalesce(jsonb_agg(a.privilege_type ORDER BY a.privilege_type),'[]'::jsonb)
 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a JOIN pg_roles gr ON gr.oid=a.grantee WHERE gr.rolname='authenticated'))
 AS evidence
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname;
SELECT jsonb_build_object('kind','default_acl','owner',pg_get_userbyid(d.defaclrole),
 'schema',coalesce(n.nspname,'GLOBAL'),'object_type',d.defaclobjtype,
 'grantee',coalesce(gr.rolname,'PUBLIC'),'privilege',a.privilege_type,'grantable',a.is_grantable) AS evidence
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
LEFT JOIN pg_roles gr ON gr.oid=a.grantee
WHERE n.nspname='public' OR d.defaclnamespace=0
ORDER BY 1;
SELECT jsonb_build_object('kind','sequence_acl','sequence',c.relname,
 'owner',pg_get_userbyid(c.relowner),'grantee',coalesce(gr.rolname,'PUBLIC'),
 'privilege',a.privilege_type) AS evidence
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('S',c.relowner))) a
LEFT JOIN pg_roles gr ON gr.oid=a.grantee
WHERE n.nspname='public' AND c.relkind='S' AND (gr.rolname IN ('anon','authenticated') OR a.grantee=0)
ORDER BY 1;
SELECT jsonb_build_object('kind','routine_acl','routine',p.proname,
 'identity_args',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,
 'grantee',coalesce(gr.rolname,'PUBLIC'),'privilege',a.privilege_type) AS evidence
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
LEFT JOIN pg_roles gr ON gr.oid=a.grantee
WHERE n.nspname='public' AND (gr.rolname IN ('anon','authenticated') OR a.grantee=0)
ORDER BY 1;
SELECT jsonb_build_object('kind','column_acl','table',c.relname,'column',a.attname,
 'grantee',coalesce(gr.rolname,'PUBLIC'),'privilege',acl.privilege_type) AS evidence
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(a.attacl) acl
LEFT JOIN pg_roles gr ON gr.oid=acl.grantee
WHERE n.nspname='public' AND c.relkind IN ('r','p')
 AND a.attnum>0 AND NOT a.attisdropped
 AND (gr.rolname IN ('anon','authenticated') OR acl.grantee=0)
ORDER BY 1;
SELECT jsonb_build_object('kind','view_security','view',c.relname,
 'owner',pg_get_userbyid(c.relowner),'security_invoker',
 coalesce('security_invoker=true'=ANY(c.reloptions),false),
 'anon_select',has_table_privilege('anon',c.oid,'SELECT'),
 'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT')) AS evidence
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('v','m')
ORDER BY c.relname;
ROLLBACK;
