-- Reference-only catalog. Never modifies existing scenario, assessment or learner data.
create table if not exists public.obd_reference_sources (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) > 0),
 publisher text not null,
 source_url text,
 licensing_status text not null default 'review_pending'
   check (licensing_status in ('review_pending','link_only','licensed','public_domain','restricted')),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.obd_reference_codes (
 id uuid primary key default gen_random_uuid(),
 protocol_generation text not null check (protocol_generation in ('OBD_I','OBD_II')),
 code text not null check (length(trim(code)) between 2 and 24),
 description text not null check (length(trim(description)) > 0),
 manufacturer text not null default 'generic',
 vehicle_model text not null default 'unspecified',
 model_year_from integer check (model_year_from between 1950 and 2100),
 model_year_to integer check (model_year_to between 1950 and 2100),
 system_category text,
 source_id uuid references public.obd_reference_sources(id) on delete restrict,
 verification_status text not null default 'unverified'
   check (verification_status in ('unverified','source_review_pending','verified','rejected')),
 applicability_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint obd_year_range check (model_year_from is null or model_year_to is null or model_year_from <= model_year_to),
 constraint obd_source_required_for_verified check (verification_status <> 'verified' or source_id is not null),
 constraint obd_code_context_unique unique (protocol_generation,code,manufacturer,vehicle_model,model_year_from,model_year_to)
);
create index if not exists obd_reference_codes_lookup_idx on public.obd_reference_codes(protocol_generation,code);
create index if not exists obd_reference_codes_source_idx on public.obd_reference_codes(source_id);
alter table public.obd_reference_sources enable row level security;
alter table public.obd_reference_codes enable row level security;
-- No client read/write policies by default. Separate reviewed API will mediate access.
revoke all on public.obd_reference_sources from anon,authenticated;
revoke all on public.obd_reference_codes from anon,authenticated;
comment on table public.obd_reference_codes is 'Developmental vehicle DTC catalog, not authoritative repair guidance; application-specific source verification required.';
