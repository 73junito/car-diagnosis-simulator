-- Restore the classroom API persistence contract used by torquemind-api.
-- Staging-first migration; RLS limits authenticated access to owned/user-scoped rows.

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  class_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);

create table if not exists public.replays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id integer not null,
  actions jsonb not null default '[]'::jsonb,
  result text,
  confidence text,
  created_at timestamptz not null default now()
);

create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  system text not null,
  scenario_ids jsonb not null,
  assigned_to jsonb,
  class_id uuid references public.classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.replays enable row level security;
alter table public.completions enable row level security;
alter table public.assignments enable row level security;

create policy "classes_select_owner" on public.classes for select to authenticated using (owner_id = auth.uid());
create policy "classes_insert_owner" on public.classes for insert to authenticated with check (owner_id = auth.uid());
create policy "classes_update_owner" on public.classes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "classes_delete_owner" on public.classes for delete to authenticated using (owner_id = auth.uid());

create policy "enrollments_select_member_or_owner" on public.enrollments for select to authenticated
using (user_id = auth.uid() or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));
create policy "enrollments_insert_self_or_owner" on public.enrollments for insert to authenticated
with check (user_id = auth.uid() or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));

create policy "replays_select_own" on public.replays for select to authenticated using (user_id = auth.uid());
create policy "replays_insert_own" on public.replays for insert to authenticated with check (user_id = auth.uid());

create policy "completions_select_own" on public.completions for select to authenticated using (user_id = auth.uid());
create policy "completions_insert_own" on public.completions for insert to authenticated with check (user_id = auth.uid());

create policy "assignments_select_class_owner" on public.assignments for select to authenticated
using (class_id is not null and exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));
create policy "assignments_insert_class_owner" on public.assignments for insert to authenticated
with check (class_id is not null and exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));

grant select, insert, update, delete on public.classes to authenticated;
grant select, insert on public.enrollments to authenticated;
grant select, insert on public.replays to authenticated;
grant select, insert on public.completions to authenticated;
grant select, insert on public.assignments to authenticated;
