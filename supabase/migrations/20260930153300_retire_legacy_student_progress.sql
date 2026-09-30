-- P0.5 legacy progress retirement.
-- Destructive by design, but fail-closed against any production drift.
-- Fresh environments that never had the legacy table remain unchanged.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  legacy_table regclass := to_regclass('public.question_attempts');
  legacy_rows bigint;
  non_anonymous_rows bigint;
  direct_view_count integer;
  second_level_view_count integer;
  third_level_view_count integer;
  external_fk_count integer;
  dep record;
begin
  if legacy_table is null then
    return;
  end if;

  select
    count(*)::bigint,
    count(*) filter (where student_id is distinct from 'anonymous')::bigint
  into legacy_rows, non_anonymous_rows
  from public.question_attempts;

  if legacy_rows <> 80 then
    raise exception 'legacy progress retirement aborted: expected 80 rows, found %', legacy_rows;
  end if;

  if non_anonymous_rows <> 0 then
    raise exception 'legacy progress retirement aborted: found % non-anonymous rows', non_anonymous_rows;
  end if;

  select count(*)::integer
  into external_fk_count
  from pg_constraint
  where contype = 'f'
    and confrelid = legacy_table;

  if external_fk_count <> 0 then
    raise exception 'legacy progress retirement aborted: found % external foreign keys', external_fk_count;
  end if;

  with direct_views as (
    select distinct c.oid
    from pg_depend d
    join pg_rewrite rw on rw.oid = d.objid
    join pg_class c on c.oid = rw.ev_class
    join pg_namespace n on n.oid = c.relnamespace
    where d.refobjid = legacy_table
      and c.oid <> legacy_table
      and c.relkind = 'v'
      and n.nspname = 'public'
  ),
  second_views as (
    select distinct c2.oid
    from direct_views v
    join pg_depend d2 on d2.refobjid = v.oid
    join pg_rewrite rw2 on rw2.oid = d2.objid
    join pg_class c2 on c2.oid = rw2.ev_class
    join pg_namespace n2 on n2.oid = c2.relnamespace
    where c2.relkind = 'v'
      and n2.nspname = 'public'
      and c2.oid <> v.oid
  ),
  third_views as (
    select distinct c3.oid
    from second_views v
    join pg_depend d3 on d3.refobjid = v.oid
    join pg_rewrite rw3 on rw3.oid = d3.objid
    join pg_class c3 on c3.oid = rw3.ev_class
    join pg_namespace n3 on n3.oid = c3.relnamespace
    where c3.relkind = 'v'
      and n3.nspname = 'public'
      and c3.oid <> v.oid
  )
  select
    (select count(*) from direct_views)::integer,
    (select count(*) from second_views)::integer,
    (select count(*) from third_views)::integer
  into direct_view_count, second_level_view_count, third_level_view_count;

  if direct_view_count <> 3
     or second_level_view_count <> 1
     or third_level_view_count <> 0 then
    raise exception
      'legacy progress retirement aborted: dependency graph drift (direct %, second %, third %)',
      direct_view_count, second_level_view_count, third_level_view_count;
  end if;

  if to_regclass('public.student_performance_summary') is null
     or to_regclass('public.student_transcript_summary') is null then
    raise exception 'legacy progress retirement aborted: expected summary views are missing';
  end if;

  for dep in
    with direct_views as (
      select distinct c.oid
      from pg_depend d
      join pg_rewrite rw on rw.oid = d.objid
      join pg_class c on c.oid = rw.ev_class
      join pg_namespace n on n.oid = c.relnamespace
      where d.refobjid = legacy_table
        and c.oid <> legacy_table
        and c.relkind = 'v'
        and n.nspname = 'public'
    )
    select distinct n2.nspname as schema_name, c2.relname as object_name
    from direct_views v
    join pg_depend d2 on d2.refobjid = v.oid
    join pg_rewrite rw2 on rw2.oid = d2.objid
    join pg_class c2 on c2.oid = rw2.ev_class
    join pg_namespace n2 on n2.oid = c2.relnamespace
    where c2.relkind = 'v'
      and n2.nspname = 'public'
      and c2.oid <> v.oid
  loop
    execute format('drop view %I.%I restrict', dep.schema_name, dep.object_name);
  end loop;

  for dep in
    select distinct n.nspname as schema_name, c.relname as object_name
    from pg_depend d
    join pg_rewrite rw on rw.oid = d.objid
    join pg_class c on c.oid = rw.ev_class
    join pg_namespace n on n.oid = c.relnamespace
    where d.refobjid = legacy_table
      and c.oid <> legacy_table
      and c.relkind = 'v'
      and n.nspname = 'public'
  loop
    execute format('drop view %I.%I restrict', dep.schema_name, dep.object_name);
  end loop;

  drop table public.question_attempts restrict;
end
$$;
