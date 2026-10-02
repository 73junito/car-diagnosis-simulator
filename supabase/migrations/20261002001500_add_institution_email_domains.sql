-- Verified institutional email domains used as an instructor-access gate.
-- Federal School Code data does not include email domains, so domains must be
-- separately verified and maintained server-side.

create table if not exists public.institution_email_domains (
  school_code text not null references public.institutions(school_code) on delete cascade,
  domain text not null,
  active boolean not null default true,
  source_reference text not null,
  verified_by uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (school_code, domain),
  constraint institution_email_domains_domain_format
    check (
      domain = lower(domain)
      and domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
    )
);

alter table public.institution_email_domains enable row level security;

revoke all on table public.institution_email_domains from public, anon, authenticated;
grant all on table public.institution_email_domains to service_role;
comment on table public.institution_email_domains is
  'Server-maintained institutional email domain allowlist. An instructor email domain must match an active verified row for the selected Federal School Code.';

comment on column public.institution_email_domains.domain is
  'Lowercase institutional email domain. Multiple verified domains may be associated with one institution.';

comment on column public.institution_email_domains.source_reference is
  'Reference documenting how the domain was verified as belonging to the institution.';
