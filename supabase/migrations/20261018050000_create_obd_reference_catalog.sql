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
 interpretation_key text not null default 'default' check (length(trim(interpretation_key)) > 0),
 source_page integer check (source_page > 0),
 source_id uuid references public.obd_reference_sources(id) on delete restrict,
 verification_status text not null default 'unverified'
   check (verification_status in ('unverified','source_review_pending','verified','rejected')),
 applicability_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint obd_year_range check ((model_year_from is null and model_year_to is null) or (model_year_from is not null and model_year_to is not null and model_year_from <= model_year_to)),
 constraint obd_generic_scope check (protocol_generation <> 'OBD_I' or (manufacturer <> 'generic' and vehicle_model <> 'unspecified' and model_year_from is not null)),
 constraint obd_source_required_for_verified check (verification_status <> 'verified' or source_id is not null),
 constraint obd_code_context_unique unique nulls not distinct (protocol_generation,code,manufacturer,vehicle_model,model_year_from,model_year_to,interpretation_key)
);
-- Fail closed for catalog verification, including privileged imports.
create or replace function public.obd_reference_require_approved_source()
returns trigger language plpgsql set search_path = '' as $$
declare source_license text;
declare source_reviewed timestamptz;
begin
 if new.verification_status = 'verified' then
   select licensing_status, reviewed_at into source_license, source_reviewed
     from public.obd_reference_sources where id = new.source_id for share;
   if source_license is null or source_license not in ('licensed','public_domain') or source_reviewed is null then
     raise exception 'verified DTC requires approved, reviewed source' using errcode = '23514';
   end if;
 end if;
 return new;
end $$;
create trigger obd_reference_code_source_gate
before insert or update of verification_status,source_id on public.obd_reference_codes
for each row execute function public.obd_reference_require_approved_source();

create or replace function public.obd_reference_block_source_downgrade()
returns trigger language plpgsql set search_path = '' as $$
begin
 if (new.licensing_status not in ('licensed','public_domain') or new.reviewed_at is null)
    and exists (select 1 from public.obd_reference_codes where source_id = new.id and verification_status = 'verified') then
   raise exception 'cannot downgrade source with verified DTCs' using errcode = '23514';
 end if;
 return new;
end $$;
create trigger obd_reference_source_downgrade_gate
before update of licensing_status,reviewed_at on public.obd_reference_sources
for each row execute function public.obd_reference_block_source_downgrade();

create index if not exists obd_reference_codes_lookup_idx on public.obd_reference_codes(protocol_generation,code);
create index if not exists obd_reference_codes_source_idx on public.obd_reference_codes(source_id);
alter table public.obd_reference_sources enable row level security;
alter table public.obd_reference_codes enable row level security;
-- No client read/write policies by default. Separate reviewed API will mediate access.
revoke all on public.obd_reference_sources from anon,authenticated;
revoke all on public.obd_reference_codes from anon,authenticated;
comment on table public.obd_reference_codes is 'Developmental vehicle DTC catalog, not authoritative repair guidance; application-specific source verification required.';
