-- G10 platform administration operational configuration.
-- High-risk operational changes remain platform-admin-only, service-role-mediated,
-- explicitly confirmed in the API, and append-only audited.

create table if not exists public.platform_operational_settings (
  setting_key text primary key default 'global'
    check (setting_key = 'global'),
  owner_bootstrap_enabled boolean not null default true,
  operations_note text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_operational_settings_note_length
    check (operations_note is null or char_length(operations_note) <= 2000)
);

insert into public.platform_operational_settings (
  setting_key,
  owner_bootstrap_enabled,
  operations_note
)
values ('global', true, null)
on conflict (setting_key) do nothing;

create table if not exists public.platform_operational_setting_events (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  actor_id uuid references auth.users(id),
  before_json jsonb not null,
  after_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists platform_operational_setting_events_created_idx
  on public.platform_operational_setting_events (created_at desc);

alter table public.platform_operational_settings enable row level security;
alter table public.platform_operational_setting_events enable row level security;

revoke all on table public.platform_operational_settings
  from public, anon, authenticated, service_role;
revoke all on table public.platform_operational_setting_events
  from public, anon, authenticated, service_role;

grant select, update on table public.platform_operational_settings to service_role;
grant select, insert on table public.platform_operational_setting_events to service_role;

create or replace function private.capture_platform_operational_setting_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.platform_operational_setting_events (
    setting_key,
    actor_id,
    before_json,
    after_json
  ) values (
    new.setting_key,
    new.updated_by,
    to_jsonb(old),
    to_jsonb(new)
  );

  return new;
end;
$$;

revoke all on function private.capture_platform_operational_setting_event()
  from public, anon, authenticated;
grant execute on function private.capture_platform_operational_setting_event()
  to service_role;

drop trigger if exists capture_platform_operational_setting_event
  on public.platform_operational_settings;

create trigger capture_platform_operational_setting_event
after update on public.platform_operational_settings
for each row
when (old.* is distinct from new.*)
execute function private.capture_platform_operational_setting_event();

comment on table public.platform_operational_settings is
  'Platform-admin-only operational configuration. Browser roles have no direct access.';

comment on table public.platform_operational_setting_events is
  'Append-only audit evidence for platform operational setting changes.';
