-- Remove historical smoke-test class fixtures while preserving the active classroom schema.
-- Fail closed on any production shape or dependency drift.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  classes_table regclass := to_regclass('public.classes');
  total_rows bigint;
  smoke_rows bigint;
  non_smoke_rows bigint;
  distinct_owners bigint;
  distinct_codes bigint;
  null_codes bigint;
  enrollment_links bigint;
  assignment_links bigint;
  scenario_assignment_links bigint;
  user_trigger_count integer;
  publication_count integer;
  incoming_fk_names text[];
  deleted_rows bigint;
begin
  if classes_table is null then
    raise exception 'historical smoke cleanup aborted: public.classes is missing';
  end if;

  select
    count(*)::bigint,
    count(*) filter (where name ~ '^Smoke Test Class [0-9]+$')::bigint,
    count(*) filter (where name !~ '^Smoke Test Class [0-9]+$')::bigint,
    count(distinct owner_id)::bigint,
    count(distinct class_code)::bigint,
    count(*) filter (where class_code is null)::bigint
  into total_rows, smoke_rows, non_smoke_rows, distinct_owners, distinct_codes, null_codes
  from public.classes;

  if smoke_rows = 0 then
    return;
  end if;

  if total_rows <> 2206
     or smoke_rows <> 2206
     or non_smoke_rows <> 0
     or distinct_owners <> 1
     or distinct_codes <> 2206
     or null_codes <> 0 then
    raise exception 'historical smoke cleanup aborted: class row-shape drift';
  end if;

  select count(*)::bigint into enrollment_links
  from public.enrollments
  where class_id is not null;

  select count(*)::bigint into assignment_links
  from public.assignments
  where class_id is not null;

  select count(*)::bigint into scenario_assignment_links
  from public.scenario_assignments
  where class_id is not null;

  if enrollment_links <> 0
     or assignment_links <> 0
     or scenario_assignment_links <> 0 then
    raise exception 'historical smoke cleanup aborted: class linkage drift';
  end if;

  select array_agg(conname order by conname) into incoming_fk_names
  from pg_constraint
  where contype = 'f'
    and confrelid = classes_table;

  if incoming_fk_names is distinct from array[
    'assignments_class_id_fkey',
    'enrollments_class_id_fkey',
    'scenario_assignments_class_id_fkey'
  ]::text[] then
    raise exception 'historical smoke cleanup aborted: incoming FK drift';
  end if;

  select count(*)::integer into user_trigger_count
  from pg_trigger
  where tgrelid = classes_table
    and not tgisinternal;

  select count(*)::integer into publication_count
  from pg_publication_rel
  where prrelid = classes_table;

  if user_trigger_count <> 0 or publication_count <> 0 then
    raise exception 'historical smoke cleanup aborted: trigger/publication drift';
  end if;

  delete from public.classes
  where name ~ '^Smoke Test Class [0-9]+$';

  get diagnostics deleted_rows = row_count;

  if deleted_rows <> 2206 then
    raise exception 'historical smoke cleanup aborted: unexpected delete count %', deleted_rows;
  end if;
end
$$;
