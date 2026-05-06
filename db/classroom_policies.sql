-- COMPLETIONS
alter table public.completions enable row level security;

drop policy if exists "completions_insert_own" on public.completions;
create policy "completions_insert_own"
  on public.completions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "completions_read_own" on public.completions;
create policy "completions_read_own"
  on public.completions
  for select
  to authenticated
  using (user_id = auth.uid());


-- ENROLLMENTS
alter table public.enrollments enable row level security;

drop policy if exists "enrollments_insert_self" on public.enrollments;
create policy "enrollments_insert_self"
  on public.enrollments
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "enrollments_read_self" on public.enrollments;
create policy "enrollments_read_self"
  on public.enrollments
  for select
  to authenticated
  using (user_id = auth.uid());


-- ASSIGNMENTS
alter table public.assignments enable row level security;

drop policy if exists "assignments_read_authenticated" on public.assignments;
create policy "assignments_read_authenticated"
  on public.assignments
  for select
  to authenticated
  using (true);


-- OPTIONAL: instructor/student legacy tables
alter table public.instructor enable row level security;
alter table public.student enable row level security;
