-- RLS policies for replays
alter table public.replays enable row level security;

-- Allow authenticated users to insert their own replays
drop policy if exists "replays_insert_own" on public.replays;
create policy "replays_insert_own"
  on public.replays
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Allow authenticated users to select their own replays
drop policy if exists "replays_read_own" on public.replays;
create policy "replays_read_own"
  on public.replays
  for select
  to authenticated
  using (user_id = auth.uid());
