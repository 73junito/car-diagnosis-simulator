create table if not exists public.approved_source_rights_scopes (
  source_id text primary key
    references public.approved_sources(id) on delete cascade,
  citation_link_allowed boolean not null default false,
  paraphrase_summary_allowed boolean not null default false,
  direct_excerpt_allowed boolean not null default false,
  figures_tables_diagrams_allowed boolean not null default false,
  database_storage_allowed boolean not null default false,
  ai_rag_ingestion_allowed boolean not null default false,
  commercial_use_allowed boolean not null default false,
  effective_at date,
  expires_at date,
  license_evidence_reference text,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_source_rights_dates_check
    check (expires_at is null or effective_at is null or expires_at >= effective_at),
  constraint approved_source_rights_review_check
    check (
      not (
        citation_link_allowed or paraphrase_summary_allowed or direct_excerpt_allowed or
        figures_tables_diagrams_allowed or database_storage_allowed or
        ai_rag_ingestion_allowed or commercial_use_allowed
      )
      or (
        reviewed_by is not null and reviewed_at is not null and
        btrim(coalesce(license_evidence_reference, '')) <> ''
      )
    )
);

comment on table public.approved_source_rights_scopes is
  'Human-reviewed, use-specific rights for approved sources. Missing or false scope values fail closed.';

alter table public.approved_source_rights_scopes enable row level security;
revoke all on public.approved_source_rights_scopes from public, anon, authenticated;
grant select, insert, update, delete on public.approved_source_rights_scopes to service_role;

insert into public.approved_source_rights_scopes (
  source_id,
  citation_link_allowed,
  paraphrase_summary_allowed,
  direct_excerpt_allowed,
  figures_tables_diagrams_allowed,
  database_storage_allowed,
  ai_rag_ingestion_allowed,
  commercial_use_allowed,
  effective_at,
  license_evidence_reference,
  review_notes,
  reviewed_by,
  reviewed_at
)
select
  id,
  true,
  true,
  true,
  true,
  true,
  false,
  true,
  license_reviewed_at::date,
  coalesce(license->>'license_url', license->>'canonical_url'),
  'Backfilled from the existing human-reviewed CC BY license record. AI/RAG ingestion remains false pending separate explicit review.',
  license_reviewed_by,
  license_reviewed_at
from public.approved_sources
where status = 'approved'
  and license_reviewed_by is not null
  and license_reviewed_at is not null
  and license->>'classification' = 'CC_BY'
  and coalesce((license->>'reuse_permission_verified')::boolean, false) = true
  and btrim(coalesce(license->>'license_url', license->>'canonical_url', '')) <> ''
on conflict (source_id) do nothing;

create or replace function public.enforce_curriculum_evidence_rights_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  scope public.approved_source_rights_scopes%rowtype;
begin
  if new.review_status = 'approved' then
    select * into scope
    from public.approved_source_rights_scopes
    where source_id = new.approved_source_id;

    if not found
      or scope.citation_link_allowed is not true
      or scope.paraphrase_summary_allowed is not true
      or scope.database_storage_allowed is not true
      or scope.reviewed_by is null
      or scope.reviewed_at is null
      or btrim(coalesce(scope.license_evidence_reference, '')) = ''
      or (scope.effective_at is not null and scope.effective_at > current_date)
      or (scope.expires_at is not null and scope.expires_at < current_date)
    then
      raise exception 'curriculum_evidence_rights_scope_required'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_curriculum_evidence_rights_scope()
  from public, anon, authenticated;
grant execute on function public.enforce_curriculum_evidence_rights_scope()
  to service_role;

drop trigger if exists curriculum_evidence_rights_scope_gate
  on public.curriculum_evidence_records;

create trigger curriculum_evidence_rights_scope_gate
before insert or update of review_status, approved_source_id
on public.curriculum_evidence_records
for each row
execute function public.enforce_curriculum_evidence_rights_scope();

comment on function public.enforce_curriculum_evidence_rights_scope() is
  'Fail-closed approval gate requiring current human-reviewed source rights for citation/link, paraphrase/summary, and database storage.';