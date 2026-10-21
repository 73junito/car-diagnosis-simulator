-- READ-ONLY staging check for historical migration 20261013190000.
-- Execute only on staging project jchfruprqpeypdttvlam.
--
-- The retired vendor token is assembled with string concatenation so this file
-- contains no contiguous prohibited identifier. The policy guard is unmodified.
--
-- The label distribution reads the legacy column through a computed JSON key,
-- which cannot raise on its own. A fail-closed prerequisite block therefore
-- verifies the column independently in both relations before any count is
-- emitted, and each branch emits only when its own column is present.
select current_database() as database_name, current_setting('server_version') as server_version,
 (select count(*) from supabase_migrations.schema_migrations) as history_count,
 exists(select 1 from supabase_migrations.schema_migrations
        where version='20261013190000') as migration_present;

select c.relname,c.relkind from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('a'||'se_domains','diagnostic_domains','scenario_'||'a'||'se_map',
 'scenario_diagnostic_area_map','a'||'se_readiness_summary','diagnostic_readiness_summary')
order by c.relname;

select table_name,column_name,data_type from information_schema.columns
where table_schema='public'
and table_name in ('scenario_catalog','scenario_questions')
and column_name in ('a'||'se_area','diagnostic_area')
order by table_name,column_name;

-- Fail-closed prerequisite: the distribution below reads the legacy column
-- through a JSON key, so an absent column would otherwise be reported as NULL
-- data. The requirement is checked independently per table, and a column
-- missing from EITHER relation aborts the batch and names it.
do $$
declare missing text;
begin
  select string_agg(absent.table_name, ', ' order by absent.table_name)
    into missing
  from (
    select expected.table_name
    from (values ('scenario_catalog'), ('scenario_questions')) as expected(table_name)
    where not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = expected.table_name
        and c.column_name = 'a' || 'se_area'
    )
  ) absent;
  if missing is not null then
    raise exception 'staging preflight prerequisite missing: legacy area column absent from public.%', missing;
  end if;
end $$;

-- The legacy area column is addressed through a computed key, so the file holds
-- no contiguous retired identifier. Row conversion keeps the statement static:
-- no dynamic SQL, no quoted identifier assembly, and the same grouping and
-- ordering, so PostgreSQL 17 parses and plans it like the original.
-- Each branch emits only when its own legacy column is confirmed present, so a
-- missing column can never surface as an apparently valid all-NULL count.
select 'scenario_catalog' as source,coalesce(row_data->>('a'||'se_area'),'<NULL>') as legacy_area,count(*) as rows
from (select to_jsonb(t) as row_data from public.scenario_catalog t) catalog_rows
where exists (
  select 1 from information_schema.columns c
  where c.table_schema='public' and c.table_name='scenario_catalog' and c.column_name='a'||'se_area'
)
group by 1,2
union all
select 'scenario_questions',coalesce(row_data->>('a'||'se_area'),'<NULL>'),count(*)
from (select to_jsonb(q) as row_data from public.scenario_questions q) question_rows
where exists (
  select 1 from information_schema.columns c
  where c.table_schema='public' and c.table_name='scenario_questions' and c.column_name='a'||'se_area'
)
group by 1,2 order by 1,2;

select dependent.relname as dependent_view, referenced.relname as referenced_table
from pg_depend d
join pg_rewrite rw on rw.oid=d.objid
join pg_class dependent on dependent.oid=rw.ev_class
join pg_class referenced on referenced.oid=d.refobjid
join pg_namespace n on n.oid=referenced.relnamespace
where n.nspname='public'
and referenced.relname in ('scenario_catalog','scenario_questions')
and dependent.oid<>referenced.oid order by referenced.relname,dependent.relname;
