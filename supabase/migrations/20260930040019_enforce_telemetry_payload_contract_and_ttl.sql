-- P0.4 telemetry retention contract.
-- Adds a 30-day logical expiry boundary without deleting production rows.
-- Physical purge automation is intentionally deferred to a separately authorized change.

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
