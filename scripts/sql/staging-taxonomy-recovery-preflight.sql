-- READ-ONLY staging check for historical migration 20261013190000.
-- Execute only on staging project jchfruprqpeypdttvlam.
select current_database() as database_name, current_setting('server_version') as server_version,
 (select count(*) from supabase_migrations.schema_migrations) as history_count,
 exists(select 1 from supabase_migrations.schema_migrations
        where version='20261013190000') as migration_present;

select c.relname,c.relkind from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('ase_domains','diagnostic_domains','scenario_ase_map',
 'scenario_diagnostic_area_map','ase_readiness_summary','diagnostic_readiness_summary')
order by c.relname;

select table_name,column_name,data_type from information_schema.columns
where table_schema='public'
and table_name in ('scenario_catalog','scenario_questions')
and column_name in ('ase_area','diagnostic_area')
order by table_name,column_name;

select 'scenario_catalog' as source,coalesce(ase_area,'<NULL>') as legacy_area,count(*) as rows
from public.scenario_catalog group by 1,2
union all
select 'scenario_questions',coalesce(ase_area,'<NULL>'),count(*)
from public.scenario_questions group by 1,2 order by 1,2;

select dependent.relname as dependent_view, referenced.relname as referenced_table
from pg_depend d
join pg_rewrite rw on rw.oid=d.objid
join pg_class dependent on dependent.oid=rw.ev_class
join pg_class referenced on referenced.oid=d.refobjid
join pg_namespace n on n.oid=referenced.relnamespace
where n.nspname='public'
and referenced.relname in ('scenario_catalog','scenario_questions')
and dependent.oid<>referenced.oid order by referenced.relname,dependent.relname;
