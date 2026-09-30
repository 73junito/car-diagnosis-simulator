-- Retire empty legacy roster shells after local/runtime dependency review.
-- Fail closed on production drift; fresh environments without these tables are unchanged.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  students_table regclass := to_regclass('public.students');
  student_table regclass := to_regclass('public.student');
  schools_table regclass := to_regclass('public.schools');
  existing_count integer;
  students_rows bigint;
  student_rows bigint;
  schools_rows bigint;
  incoming_fk_count integer;
  dependent_view_count integer;
  user_trigger_count integer;
  routine_ref_count integer;
  publication_count integer;
begin
  existing_count :=
    (students_table is not null)::integer +
    (student_table is not null)::integer +
    (schools_table is not null)::integer;

  if existing_count = 0 then
    return;
  end if;

  if existing_count <> 3 then
    raise exception 'legacy roster retirement aborted: partial table-presence drift';
  end if;

  select count(*)::bigint into students_rows from public.students;
  select count(*)::bigint into student_rows from public.student;
  select count(*)::bigint into schools_rows from public.schools;

  if students_rows <> 0 or student_rows <> 0 or schools_rows <> 0 then
    raise exception 'legacy roster retirement aborted: expected all target tables empty';
  end if;

  select count(*)::integer into incoming_fk_count
  from pg_constraint
  where contype = 'f'
    and confrelid in (students_table, student_table, schools_table)
    and conrelid not in (students_table, student_table, schools_table);

  select count(distinct c.oid)::integer into dependent_view_count
  from pg_depend d
  join pg_rewrite rw on rw.oid = d.objid
  join pg_class c on c.oid = rw.ev_class
  where d.refobjid in (students_table, student_table, schools_table)
    and c.relkind in ('v', 'm')
    and c.oid not in (students_table, student_table, schools_table);

  select count(*)::integer into user_trigger_count
  from pg_trigger
  where tgrelid in (students_table, student_table, schools_table)
    and not tgisinternal;

  select count(*)::integer into routine_ref_count
  from information_schema.routines
  where routine_schema not in ('pg_catalog', 'information_schema')
    and (
      coalesce(routine_definition, '') ilike '%public.students%'
      or coalesce(routine_definition, '') ilike '%public.student%'
      or coalesce(routine_definition, '') ilike '%public.schools%'
    );

  select count(*)::integer into publication_count
  from pg_publication_rel
  where prrelid in (students_table, student_table, schools_table);

  if incoming_fk_count <> 0
     or dependent_view_count <> 0
     or user_trigger_count <> 0
     or routine_ref_count <> 0
     or publication_count <> 0 then
    raise exception 'legacy roster retirement aborted: dependency drift';
  end if;

  -- Drop the child table first so its outgoing FKs disappear with it.
  drop table public.students restrict;
  drop table public.student restrict;
  drop table public.schools restrict;
end
$$;
