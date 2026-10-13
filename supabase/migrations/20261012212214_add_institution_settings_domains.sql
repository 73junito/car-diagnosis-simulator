-- G8 institution settings and verified-domain administration.
-- Active institution membership remains the tenant authorization boundary.
-- Verified domains are affiliation evidence only and never create membership or admin access.

create table if not exists public.institution_settings (
  school_code text primary key references public.institutions(school_code) on delete cascade,
  display_name text,
  website_url text,
  support_email text,
  timezone text,
  locale text not null default 'en-US',
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_settings_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 160),
  constraint institution_settings_website_url_format
    check (website_url is null or website_url ~ '^https://[^[:space:]]+$'),
  constraint institution_settings_support_email_format
    check (support_email is null or support_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint institution_settings_timezone_length
    check (timezone is null or char_length(btrim(timezone)) between 1 and 100),
  constraint institution_settings_locale_length
    check (char_length(btrim(locale)) between 2 and 35)
);

alter table public.institution_email_domains
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deactivated_by uuid references auth.users(id),
  add column if not exists deactivated_at timestamptz;

alter table public.institution_email_domains
  drop constraint if exists institution_email_domains_deactivation_metadata_check;

alter table public.institution_email_domains
  add constraint institution_email_domains_deactivation_metadata_check
  check (
    (active = true and deactivated_by is null and deactivated_at is null)
    or
    (active = false and deactivated_by is not null and deactivated_at is not null)
  );

create table if not exists public.institution_settings_events (
  id uuid primary key default gen_random_uuid(),
  school_code text not null references public.institutions(school_code),
  actor_id uuid references auth.users(id),
  action text not null check (action in ('created', 'updated')),
  before_json jsonb,
  after_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists institution_settings_events_school_created_idx
  on public.institution_settings_events (school_code, created_at desc);

create table if not exists public.institution_domain_events (
  id uuid primary key default gen_random_uuid(),
  school_code text not null references public.institutions(school_code),
  domain text not null,
  actor_id uuid references auth.users(id),
  action text not null check (action in ('added', 'reactivated', 'deactivated', 'source_updated')),
  source_reference text,
  created_at timestamptz not null default now()
);

create index if not exists institution_domain_events_school_created_idx
  on public.institution_domain_events (school_code, created_at desc);

alter table public.institution_settings enable row level security;
alter table public.institution_settings_events enable row level security;
alter table public.institution_domain_events enable row level security;

revoke all on table public.institution_settings from public, anon, authenticated, service_role;
revoke all on table public.institution_settings_events from public, anon, authenticated, service_role;
revoke all on table public.institution_domain_events from public, anon, authenticated, service_role;

grant select, insert, update on table public.institution_settings to service_role;
grant select, insert on table public.institution_settings_events to service_role;
grant select, insert on table public.institution_domain_events to service_role;

-- Domain administration is soft-state only. Existing verified rows are never deleted by the app.
revoke delete on table public.institution_email_domains from service_role;

create or replace function private.capture_institution_settings_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.institution_settings_events (
    school_code, actor_id, action, before_json, after_json
  ) values (
    new.school_code,
    new.updated_by,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke all on function private.capture_institution_settings_event()
  from public, anon, authenticated;
grant execute on function private.capture_institution_settings_event()
  to service_role;

drop trigger if exists capture_institution_settings_event
  on public.institution_settings;

create trigger capture_institution_settings_event
after insert or update on public.institution_settings
for each row
execute function private.capture_institution_settings_event();

create or replace function private.capture_institution_domain_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'added';
  elsif old.active is distinct from new.active and new.active = true then
    v_action := 'reactivated';
  elsif old.active is distinct from new.active and new.active = false then
    v_action := 'deactivated';
  elsif old.source_reference is distinct from new.source_reference then
    v_action := 'source_updated';
  else
    return new;
  end if;

  insert into public.institution_domain_events (
    school_code, domain, actor_id, action, source_reference
  ) values (
    new.school_code, new.domain, new.updated_by, v_action, new.source_reference
  );
  return new;
end;
$$;

revoke all on function private.capture_institution_domain_event()
  from public, anon, authenticated;
grant execute on function private.capture_institution_domain_event()
  to service_role;

drop trigger if exists capture_institution_domain_event
  on public.institution_email_domains;

create trigger capture_institution_domain_event
after insert or update of active, source_reference on public.institution_email_domains
for each row
execute function private.capture_institution_domain_event();

update public.institution_email_domains
set updated_at = coalesce(updated_at, verified_at),
    updated_by = coalesce(updated_by, verified_by)
where updated_by is null;

comment on table public.institution_settings is
  'Tenant-managed display/contact settings. Active institution membership remains the authorization boundary.';

comment on table public.institution_settings_events is
  'Append-only audit evidence for institution setting changes.';

comment on table public.institution_domain_events is
  'Append-only audit evidence for verified-domain administration.';

comment on table public.institution_email_domains is
  'Server-maintained verified institutional domains used as affiliation evidence. A matching domain never creates institution membership, instructor role, institution-admin role, or assessment eligibility.';
