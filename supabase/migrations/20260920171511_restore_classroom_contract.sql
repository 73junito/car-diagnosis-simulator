-- Restore the classroom tables required by the application and the staging smoke tests.
-- Staging lost public.classes, public.users, public.replays, public.completions,
-- public.assignments and public.enrollments.
-- Table shapes: torquemind-api/db/schema.sql.
-- Privileges: db/migrations/20260527_grant_public_tables.sql.
-- Row policies: db/rls_hardening.sql plus the carried-forward
-- enrollments_insert_self policy from db/classroom_policies.sql.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text,
  owner_id uuid,
  class_code text unique,
  created_at timestamp default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  role text,
  created_at timestamp default now()
);

create table public.replays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  scenario_id int,
  actions jsonb,
  result text,
  confidence text,
  created_at timestamp default now()
);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  scenario_id int,
  completed_at timestamp default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  system text,
  scenario_ids jsonb,
  assigned_to jsonb,
  class_id uuid,
  created_at timestamp default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid,
  user_id uuid,
  created_at timestamp default now()
);

alter table public.classes enable row level security;
alter table public.users enable row level security;
alter table public.replays enable row level security;
alter table public.completions enable row level security;
alter table public.assignments enable row level security;
alter table public.enrollments enable row level security;

revoke all on table public.classes from public, anon, authenticated;
revoke all on table public.users from public, anon, authenticated;
revoke all on table public.replays from public, anon, authenticated;
revoke all on table public.completions from public, anon, authenticated;
revoke all on table public.assignments from public, anon, authenticated;
revoke all on table public.enrollments from public, anon, authenticated;

grant select, insert, update, delete on table public.classes to authenticated;
grant select, insert, update, delete on table public.replays to authenticated;
grant select, insert, update, delete on table public.completions to authenticated;
grant select, insert, update, delete on table public.assignments to authenticated;
grant select, insert, update, delete on table public.enrollments to authenticated;
grant select on table public.users to authenticated;

create policy "classes_insert_owner"
  on public.classes
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "classes_read_owner"
  on public.classes
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "enrollments_insert_self"
  on public.enrollments
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "enrollments_read_for_owner_or_self"
  on public.enrollments
  for select
  to authenticated
  using (
    user_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM public.classes c
      WHERE c.id = enrollments.class_id
        AND c.owner_id = auth.uid()
    )
  );

create policy "replays_read_owner_or_self"
  on public.replays
  for select
  to authenticated
  using (
    user_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM public.enrollments e
      JOIN public.classes c ON e.class_id = c.id
      WHERE e.user_id = replays.user_id
        AND c.owner_id = auth.uid()
    )
  );

create policy "replays_insert_own"
  on public.replays
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "completions_read_owner_or_self"
  on public.completions
  for select
  to authenticated
  using (
    user_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM public.enrollments e
      JOIN public.classes c ON e.class_id = c.id
      WHERE e.user_id = completions.user_id
        AND c.owner_id = auth.uid()
    )
  );

create policy "completions_insert_own"
  on public.completions
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "assignments_read_restricted"
  on public.assignments
  for select
  to authenticated
  using (
    (assigned_to::text LIKE ('%"' || auth.uid() || '"%'))
    OR EXISTS(
      SELECT 1 FROM public.classes c
      WHERE c.owner_id = auth.uid()
        AND assigned_to::text LIKE ('%"' || c.id::text || '"%')
    )
  );

create policy "users_read_own"
  on public.users
  for select
  to authenticated
  using (id = auth.uid());
