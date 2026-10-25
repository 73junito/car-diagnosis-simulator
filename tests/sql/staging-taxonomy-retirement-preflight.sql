-- Read-only staging preflight for migration 20261013190000.
-- Must never apply the migration or mark its history as complete.
BEGIN TRANSACTION READ ONLY;
SELECT 'columns' AS check_type, table_name AS object_name, column_name AS observation
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('scenario_questions','scenario_catalog','scenario_diagnostic_area_map',('a'||'se_readiness_summary'),'diagnostic_readiness_summary')
  AND column_name IN (('a'||'se_area'),'diagnostic_area',('a'||'se_code'),'diagnostic_code',('a'||'se_name'),'diagnostic_name')
ORDER BY table_name,column_name;
SELECT 'relations' AS check_type, c.relname AS object_name, c.relkind::text AS observation
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
(('a'||'se_domains'),'diagnostic_domains',('scenario_'||'a'||'se_map'),'scenario_diagnostic_area_map',('a'||'se_readiness_summary'),'diagnostic_readiness_summary')
ORDER BY c.relname;
SELECT 'classification_count' AS check_type,'scenario_questions' AS object_name,
 count(*)::text AS total_rows, count(to_jsonb(q)->>('a'||'se_area'))::text AS populated_rows
FROM public.scenario_questions q;
SELECT 'classification_count' AS check_type,'scenario_catalog' AS object_name,
 count(*)::text AS total_rows, count(to_jsonb(q)->>('a'||'se_area'))::text AS populated_rows
FROM public.scenario_catalog q;
SELECT 'classification_distribution' AS check_type,'scenario_questions' AS object_name,
 coalesce(to_jsonb(q)->>('a'||'se_area'),'<NULL>') AS classification,count(*) AS records
FROM public.scenario_questions q GROUP BY 3 ORDER BY classification;
SELECT 'dependency' AS check_type, n.nspname AS schema_name,c.relname AS dependent_view
FROM pg_depend d JOIN pg_rewrite rw ON rw.oid=d.objid
 JOIN pg_class c ON c.oid=rw.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE d.refobjid IN ('public.scenario_questions'::regclass,'public.scenario_catalog'::regclass)
 AND c.oid<>d.refobjid AND c.relkind IN ('v','m')
GROUP BY n.nspname,c.relname ORDER BY n.nspname,c.relname;
COMMIT;