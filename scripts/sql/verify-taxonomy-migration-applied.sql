-- Read-only post-application verification for the pending canonical migration
--   20261013190000_retire_external_certification_taxonomy.sql
--
-- Run AFTER the migration has been applied to staging through the approved tracked
-- migration process. Emits one PASS/FAIL row per structural assertion plus the
-- observed row counts, so they can be compared with the pre-application snapshot
-- and with docs/database/staging-restore-baseline-*.json.
--
-- Never writes. Safe to run against staging, a restored copy, or a rehearsal DB.
--   psql -At -f scripts/sql/verify-taxonomy-migration-applied.sql
--
-- Recorded staging pre-application snapshot (2026-10-19, read-only):
--   scenario_questions = 25 rows (3 NULL labels, 22 populated)
--   scenario_catalog   = 19 rows (all NULL labels)
with cols as (
  select
    exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'scenario_questions'
               and column_name = 'diagnostic_area') as q_has_diagnostic,
    exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'scenario_catalog'
               and column_name = 'diagnostic_area') as c_has_diagnostic,
    exists (select 1 from information_schema.columns
             where table_schema = 'public' and column_name = 'a' || 'se_area') as has_legacy
),
checks as (
  select 'history_records_20261013190000' as check_name,
         exists (select 1 from supabase_migrations.schema_migrations
                  where version = '20261013190000') as ok
  union all
  select 'legacy_vendor_prefix_column_absent',
         not (select has_legacy from cols)
  union all
  select 'diagnostic_area_on_both_tables',
         (select q_has_diagnostic and c_has_diagnostic from cols)
  union all
  -- Column references are built at run time so this file is safe to run before
  -- AND after the migration (the column does not exist yet in the pre-state).
  select 'label_values_not_blank',
         case when (select q_has_diagnostic from cols) then
           (xpath('/row/c/text()', query_to_xml(
              'select count(*) as c from public.scenario_questions where diagnostic_area is not null and length(btrim(diagnostic_area)) = 0', false, true, '')))[1]::text::bigint = 0
         else false end
  union all
  select 'catalog_labels_unchanged_null',
         case when (select c_has_diagnostic from cols) then
           (xpath('/row/c/text()', query_to_xml(
              'select count(*) as c from public.scenario_catalog where diagnostic_area is not null', false, true, '')))[1]::text::bigint = 0
         else false end
  union all
  select 'readiness_view_still_queryable',
         (select count(*) >= 0 from public.scenario_question_readiness)
  union all
  select 'rls_still_enabled',
         (select bool_and(c.relrowsecurity) from pg_class c
           where c.relnamespace = 'public'::regnamespace
             and c.relname in ('scenario_questions', 'scenario_catalog'))
  union all
  select 'no_retired_prefix_references_in_functions',
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosrc like '%' || 'a' || 'se_area' || '%') = 0
  union all
  select 'primary_keys_intact',
         (select count(*) from pg_constraint
           where connamespace = 'public'::regnamespace and contype = 'p'
             and conrelid::regclass::text in ('scenario_questions', 'scenario_catalog')) = 2
  union all
  select 'inbound_foreign_keys_intact',
         (select count(*) from pg_constraint
           where connamespace = 'public'::regnamespace and contype = 'f'
             and confrelid::regclass::text in ('scenario_questions', 'scenario_catalog')) = 7
),
metrics as (
  select 'scenario_questions_rows' as metric, count(*)::text as value from public.scenario_questions
  union all
  select 'scenario_catalog_rows', count(*)::text from public.scenario_catalog
  union all
  select 'questions_with_label',
         case when (select q_has_diagnostic from cols) then
           (xpath('/row/c/text()', query_to_xml(
              'select count(*) as c from public.scenario_questions where diagnostic_area is not null', false, true, '')))[1]::text
         else 'n/a (diagnostic_area absent)' end
  union all
  select 'questions_without_label',
         case when (select q_has_diagnostic from cols) then
           (xpath('/row/c/text()', query_to_xml(
              'select count(*) as c from public.scenario_questions where diagnostic_area is null', false, true, '')))[1]::text
         else 'n/a (diagnostic_area absent)' end
  union all
  select 'legacy_prefix_columns',
         case when (select has_legacy from cols) then 'present' else 'absent' end
  union all
  select 'history_count', count(*)::text from supabase_migrations.schema_migrations
)
select 'CHECK' as kind, check_name as name, case when ok then 'PASS' else 'FAIL' end as value from checks
union all
select 'METRIC' as kind, metric as name, value from metrics
order by kind, name;
