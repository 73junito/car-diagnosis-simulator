create table if not exists public.curriculum_enhancement_drafts (
  id uuid primary key default gen_random_uuid(),
  lesson_plan_id text not null references public.curriculum_lesson_plans(id) on delete restrict,
  goal text not null check (btrim(goal) <> ''),
  status text not null default 'draft' check (status in ('draft','reviewed','rejected')),
  draft_payload jsonb not null default '{}'::jsonb,
  ai_provider text not null,
  ai_model text not null,
  prompt_version text not null default 'curriculum-enhancement-v1',
  requested_by uuid not null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  scored_assessment_eligible boolean not null default false check (scored_assessment_eligible = false),
  assessment_generation_allowed boolean not null default false check (assessment_generation_allowed = false),
  publication_status text not null default 'draft-only' check (publication_status = 'draft-only'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_enhancement_review_state_check check (
    (status = 'draft' and reviewed_by is null and reviewed_at is null)
    or (status in ('reviewed','rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create table if not exists public.curriculum_enhancement_draft_evidence (
  draft_id uuid not null references public.curriculum_enhancement_drafts(id) on delete cascade,
  evidence_id uuid not null references public.curriculum_evidence_records(id) on delete restrict,
  source_id text not null references public.approved_sources(id) on delete restrict,
  rights_reviewed_at_snapshot timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (draft_id, evidence_id)
);

comment on table public.curriculum_enhancement_drafts is
  'Instructor-requested AI curriculum enhancement drafts. Draft-only; no publishing or assessment eligibility.';
comment on table public.curriculum_enhancement_draft_evidence is
  'Evidence bound to an enhancement draft after approval and explicit AI/RAG rights validation.';

alter table public.curriculum_enhancement_drafts enable row level security;
alter table public.curriculum_enhancement_draft_evidence enable row level security;
revoke all on public.curriculum_enhancement_drafts from public, anon, authenticated;
revoke all on public.curriculum_enhancement_draft_evidence from public, anon, authenticated;
grant select, insert, update, delete on public.curriculum_enhancement_drafts to service_role;
grant select, insert, update, delete on public.curriculum_enhancement_draft_evidence to service_role;

create index if not exists idx_curriculum_enhancement_drafts_lesson_created
  on public.curriculum_enhancement_drafts(lesson_plan_id, created_at desc);
create index if not exists idx_curriculum_enhancement_draft_evidence_source
  on public.curriculum_enhancement_draft_evidence(source_id);

create or replace function public.enforce_curriculum_enhancement_evidence()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  ev public.curriculum_evidence_records%rowtype;
  scope public.approved_source_rights_scopes%rowtype;
  draft_lesson_id text;
  evidence_lesson_id text;
  source_status text;
begin
  select * into ev from public.curriculum_evidence_records where id = new.evidence_id;
  if not found
    or ev.review_status <> 'approved'
    or ev.license_status <> 'verified-for-use'
    or ev.scored_assessment_eligible is not false
    or ev.approved_source_id is null
    or ev.approved_source_id <> new.source_id
  then
    raise exception 'curriculum_enhancement_evidence_not_approved' using errcode='23514';
  end if;

  select lesson_plan_id into draft_lesson_id
  from public.curriculum_enhancement_drafts
  where id = new.draft_id;

  select lesson_plan_id into evidence_lesson_id
  from public.curriculum_module_gaps
  where id = ev.gap_id;

  select status into source_status
  from public.approved_sources
  where id = new.source_id;

  if draft_lesson_id is null
    or evidence_lesson_id is null
    or draft_lesson_id <> evidence_lesson_id
    or source_status <> 'approved'
  then
    raise exception 'curriculum_enhancement_lesson_or_source_invalid' using errcode='23514';
  end if;

  select * into scope from public.approved_source_rights_scopes where source_id = new.source_id;
  if not found
    or scope.ai_rag_ingestion_allowed is not true
    or scope.citation_link_allowed is not true
    or scope.paraphrase_summary_allowed is not true
    or scope.database_storage_allowed is not true
    or scope.reviewed_by is null
    or scope.reviewed_at is null
    or btrim(coalesce(scope.license_evidence_reference,'')) = ''
    or (scope.effective_at is not null and scope.effective_at > current_date)
    or (scope.expires_at is not null and scope.expires_at < current_date)
  then
    raise exception 'curriculum_enhancement_ai_rights_required' using errcode='23514';
  end if;

  new.rights_reviewed_at_snapshot := scope.reviewed_at;
  return new;
end;
$$;

revoke all on function public.enforce_curriculum_enhancement_evidence() from public, anon, authenticated;
grant execute on function public.enforce_curriculum_enhancement_evidence() to service_role;

drop trigger if exists curriculum_enhancement_evidence_gate on public.curriculum_enhancement_draft_evidence;
create trigger curriculum_enhancement_evidence_gate
before insert or update of evidence_id, source_id
on public.curriculum_enhancement_draft_evidence
for each row execute function public.enforce_curriculum_enhancement_evidence();