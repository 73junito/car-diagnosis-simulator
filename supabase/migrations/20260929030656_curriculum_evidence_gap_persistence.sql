begin;

create table if not exists public.curriculum_module_gaps (
  id uuid primary key default gen_random_uuid(),
  lesson_plan_id text not null,
  course_id text not null,
  competency_id text not null,
  academic_level text not null check (academic_level in ('undergraduate','graduate')),
  gap_type text not null check (gap_type in ('coverage','currency','evidence','practice','visual','other')),
  gap_summary text not null check (btrim(gap_summary) <> ''),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'identified'
    check (status in ('identified','researching','evidence-pending','evidence-sufficient','closed')),
  created_by uuid not null,
  closed_by uuid,
  closed_at timestamptz,
  scored_assessment_eligible boolean not null default false
    check (scored_assessment_eligible = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_module_gaps_lesson_mapping_fkey
    foreign key (lesson_plan_id, course_id, competency_id, academic_level)
    references public.curriculum_lesson_plans(id, course_id, competency_id, academic_level)
    on delete cascade,
  constraint curriculum_module_gaps_closed_state_check
    check ((status = 'closed' and closed_by is not null and closed_at is not null)
      or (status <> 'closed' and closed_at is null))
);

create table if not exists public.curriculum_evidence_records (
  id uuid primary key default gen_random_uuid(),
  gap_id uuid not null references public.curriculum_module_gaps(id) on delete cascade,
  discovery_provider text not null check (btrim(discovery_provider) <> ''),
  provider_record_id text not null check (btrim(provider_record_id) <> ''),
  title text not null check (btrim(title) <> ''),
  authors jsonb not null default '[]'::jsonb,
  publication_year integer check (publication_year is null or publication_year >= 1800),
  venue text,
  doi text,
  source_url text,
  abstract text,
  citation_count integer check (citation_count is null or citation_count >= 0),
  open_access_pdf_url text,
  open_access_license text,
  provider_metadata jsonb not null default '{}'::jsonb,
  review_status text not null default 'discovered'
    check (review_status in ('discovered','reviewed','license-verified','approved','rejected')),
  license_status text not null default 'unverified'
    check (license_status in ('unverified','review-required','verified-for-use','restricted','unknown')),
  literature_catalog_id uuid references public.literature_catalog(id) on delete set null,
  saved_by uuid not null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  license_reviewed_by uuid,
  license_reviewed_at timestamptz,
  scored_assessment_eligible boolean not null default false
    check (scored_assessment_eligible = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),  constraint curriculum_evidence_records_gap_provider_unique
    unique (gap_id, discovery_provider, provider_record_id),
  constraint curriculum_evidence_records_approval_gate
    check (
      review_status <> 'approved'
      or (
        reviewed_by is not null
        and reviewed_at is not null
        and license_status = 'verified-for-use'
        and license_reviewed_by is not null
        and license_reviewed_at is not null
      )
    )
);

create index if not exists idx_curriculum_module_gaps_lesson_status
  on public.curriculum_module_gaps(lesson_plan_id, status);
create index if not exists idx_curriculum_module_gaps_course_status
  on public.curriculum_module_gaps(course_id, status);
create index if not exists idx_curriculum_evidence_records_gap_status
  on public.curriculum_evidence_records(gap_id, review_status);
create index if not exists idx_curriculum_evidence_records_provider
  on public.curriculum_evidence_records(discovery_provider, provider_record_id);

comment on table public.curriculum_module_gaps is
  'Instructor-identified curriculum coverage gaps. Records are non-assessment workflow state and cannot grant scored-assessment eligibility.';
comment on table public.curriculum_evidence_records is
  'Scholarly discovery records tied to curriculum gaps. Approval requires human review and verified reuse rights; records cannot grant scored-assessment eligibility.';

alter table public.curriculum_module_gaps enable row level security;
alter table public.curriculum_evidence_records enable row level security;

revoke all on table public.curriculum_module_gaps from public, anon, authenticated;
revoke all on table public.curriculum_evidence_records from public, anon, authenticated;

grant select, insert, update, delete on table public.curriculum_module_gaps to service_role;
grant select, insert, update, delete on table public.curriculum_evidence_records to service_role;

commit;
