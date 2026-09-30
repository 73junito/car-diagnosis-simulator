-- Retire the legacy student recommendation store after the application stops reading it.
-- Fail closed on production drift; fresh environments without the table are unchanged.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  legacy_table regclass := to_regclass('public.student_recommendations');
  legacy_rows bigint;
  non_anonymous_rows bigint;
  external_fk_count integer;
  dependent_view_count integer;
  user_trigger_count integer;
  routine_ref_count integer;
begin
  if legacy_table is null then
    return;
  end if;

  select count(*)::bigint,
         count(*) filter (where student_id is distinct from 'anonymous')::bigint
  into legacy_rows, non_anonymous_rows
  from public.student_recommendations;

  if legacy_rows <> 6 or non_anonymous_rows <> 0 then
    raise exception 'legacy recommendation retirement aborted: row/anonymity drift';
  end if;

  select count(*)::integer into external_fk_count
  from pg_constraint
  where contype = 'f' and confrelid = legacy_table;

  select count(distinct c.oid)::integer into dependent_view_count
  from pg_depend d
  join pg_rewrite rw on rw.oid = d.objid
  join pg_class c on c.oid = rw.ev_class
  where d.refobjid = legacy_table and c.relkind = 'v' and c.oid <> legacy_table;

  select count(*)::integer into user_trigger_count
  from pg_trigger
  where tgrelid = legacy_table and not tgisinternal;

  select count(*)::integer into routine_ref_count
  from information_schema.routines
  where routine_schema not in ('pg_catalog', 'information_schema')
    and coalesce(routine_definition, '') ilike '%student_recommendations%';

  if external_fk_count <> 0 or dependent_view_count <> 0
     or user_trigger_count <> 0 or routine_ref_count <> 0 then
    raise exception 'legacy recommendation retirement aborted: dependency drift';
  end if;

  drop table public.student_recommendations restrict;
end
$$;
