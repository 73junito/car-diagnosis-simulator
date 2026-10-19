-- Read-only post-rehearsal verification for the pending taxonomy migration.
-- Emits one PASS/FAIL row per assertion; any FAIL means the rehearsal failed.
-- Run only inside the disposable rehearsal database.
with checks as (
  select 'legacy_vendor_prefix_column_absent' as check_name,
         (select count(*) from information_schema.columns
           where table_schema = 'public' and column_name = 'a' || 'se_area') = 0 as ok
  union all
  select 'diagnostic_area_present_on_both_tables',
         (select count(*) from information_schema.columns
           where table_schema = 'public' and column_name = 'diagnostic_area'
             and table_name in ('scenario_questions', 'scenario_catalog')) = 2
  union all
  select 'scenario_questions_row_count_preserved',
         (select count(*) from public.scenario_questions) = 25
  union all
  select 'scenario_catalog_row_count_preserved',
         (select count(*) from public.scenario_catalog) = 19
  union all
  select 'question_label_values_preserved',
         (select count(*) from public.scenario_questions where diagnostic_area = 'Starter System') = 6
         and (select count(*) from public.scenario_questions where diagnostic_area = 'CI') = 7
         and (select count(*) from public.scenario_questions where diagnostic_area = 'DI') = 4
         and (select count(*) from public.scenario_questions where diagnostic_area = 'Mechanical Components') = 1
         and (select count(*) from public.scenario_questions where diagnostic_area = 'Electrical and Electrical Components') = 4
         and (select count(*) from public.scenario_questions where diagnostic_area is null) = 3
  union all
  select 'catalog_labels_still_null',
         (select count(*) from public.scenario_catalog where diagnostic_area is null) = 19
  union all
  select 'readiness_view_still_queryable',
         (select count(*) >= 0 from public.scenario_question_readiness)
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
  union all
  select 'no_retired_prefix_references_in_functions',
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosrc like '%' || 'a' || 'se_area' || '%') = 0
  union all
  select 'rls_still_enabled',
         (select bool_and(relrowsecurity) from pg_class
           where relnamespace = 'public'::regnamespace
             and relname in ('scenario_questions', 'scenario_catalog'))
)
select check_name, case when ok then 'PASS' else 'FAIL' end as result
from checks order by check_name;
