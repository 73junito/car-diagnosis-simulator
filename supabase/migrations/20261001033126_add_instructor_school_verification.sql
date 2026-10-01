-- Instructor institution verification.
-- Federal School Code identifies an institution only; it never grants instructor access.

create table if not exists public.institutions (
  school_code text primary key,
  school_name text not null,
  address text,
  city text,
  state_code text,
  zip_code text,
  province text,
  country text,
  postal_code text,
  source_name text not null default 'Federal School Code List',
  source_period text not null default '2026-27 4th Quarter',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institutions_school_code_format
    check (school_code ~ '^[A-Z0-9]{6}$')
);

create table if not exists public.instructor_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_code text not null references public.institutions(school_code),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  verification_method text not null default 'school_code_plus_affiliation_review'
    check (verification_method = 'school_code_plus_affiliation_review'),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text,
  unique (user_id)
);

create index if not exists instructor_verification_requests_school_code_idx
  on public.instructor_verification_requests(school_code);

alter table public.institutions enable row level security;
alter table public.instructor_verification_requests enable row level security;

revoke all on table public.institutions from public, anon, authenticated;
revoke all on table public.instructor_verification_requests from public, anon, authenticated;

grant all on table public.institutions to service_role;
grant all on table public.instructor_verification_requests to service_role;

comment on table public.institutions is
  'Server-side institution directory sourced from the 2026-27 4th Quarter Federal School Code List. School-code match identifies an institution but does not verify instructor affiliation.';

comment on table public.instructor_verification_requests is
  'Instructor affiliation verification workflow. A pending request never grants instructor role or instructor API access.';

comment on column public.instructor_verification_requests.status is
  'Only approved status may be used as an instructor-affiliation authorization signal.';
