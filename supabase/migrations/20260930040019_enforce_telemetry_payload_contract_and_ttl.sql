-- P0.4 telemetry retention contract.
-- Supabase Branching applies supabase/migrations/**, while the legacy telemetry
-- baseline originally lived under db/migrations/**. Recreate the canonical
-- telemetry table only when absent so preview branches and production converge.
-- Adds a 30-day logical expiry boundary without deleting production rows.
-- Physical purge automation is intentionally deferred to a separately authorized change.

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  user_id uuid,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  source text not null default 'telemetry',
  created_at timestamptz not null default now()
);

create index if not exists idx_telemetry_events_session_id
  on public.telemetry_events (session_id);

create index if not exists idx_telemetry_events_created_at
  on public.telemetry_events (created_at desc);

alter table public.telemetry_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'telemetry_events'
      and policyname = 'telemetry_events_select_none'
  ) then
    create policy telemetry_events_select_none
      on public.telemetry_events for select
      to anon, authenticated
      using (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'telemetry_events'
      and policyname = 'telemetry_events_insert_none'
  ) then
    create policy telemetry_events_insert_none
      on public.telemetry_events for insert
      to anon, authenticated
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'telemetry_events'
      and policyname = 'telemetry_events_update_none'
  ) then
    create policy telemetry_events_update_none
      on public.telemetry_events for update
      to anon, authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'telemetry_events'
      and policyname = 'telemetry_events_delete_none'
  ) then
    create policy telemetry_events_delete_none
      on public.telemetry_events for delete
      to anon, authenticated
      using (false);
  end if;
end
$$;

alter table public.telemetry_events
  add column if not exists expires_at timestamptz;

update public.telemetry_events
set expires_at = created_at + interval '30 days'
where expires_at is null;

alter table public.telemetry_events
  alter column expires_at set default (now() + interval '30 days'),
  alter column expires_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'telemetry_events_expires_after_created'
      and conrelid = 'public.telemetry_events'::regclass
  ) then
    alter table public.telemetry_events
      add constraint telemetry_events_expires_after_created
      check (expires_at > created_at);
  end if;
end
$$;

create index if not exists idx_telemetry_events_expires_at
  on public.telemetry_events (expires_at);

comment on column public.telemetry_events.expires_at is
  'Logical telemetry expiry. P0.4 baseline is 30 days from creation. Physical purge is governed separately.';
