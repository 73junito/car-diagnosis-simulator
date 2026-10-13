-- G7 authoring evidence/source linkage.
-- Links private scenario drafts only to already-approved governed source chunks.
-- This linkage does not publish content or grant training/assessment eligibility.

create table if not exists public.scenario_authoring_draft_evidence (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.scenario_authoring_drafts(id) on delete cascade,
  source_id text not null references public.approved_sources(id) on delete restrict,
  chunk_id text not null references public.source_chunks(chunk_id) on delete restrict,
  evidence_role text not null
    check (evidence_role in ('supports-scenario','supports-diagnosis','supports-repair','research-reference')),
  claim_text text not null
    check (char_length(btrim(claim_text)) between 1 and 1000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (draft_id, chunk_id, evidence_role, claim_text)
);

create index if not exists scenario_authoring_draft_evidence_draft_idx
  on public.scenario_authoring_draft_evidence (draft_id, created_at);

alter table public.scenario_authoring_draft_evidence enable row level security;

revoke all on table public.scenario_authoring_draft_evidence
  from public, anon, authenticated, service_role;
grant select, insert, delete on table public.scenario_authoring_draft_evidence
  to service_role;

create or replace function private.enforce_scenario_authoring_evidence_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_draft public.scenario_authoring_drafts%rowtype;
  v_chunk public.source_chunks%rowtype;
  v_source public.approved_sources%rowtype;
  v_draft_id uuid;
begin
  v_draft_id := case when tg_op = 'DELETE' then old.draft_id else new.draft_id end;

  select * into v_draft
  from public.scenario_authoring_drafts
  where id = v_draft_id;

  if not found then
    raise exception 'authoring_evidence_rejected: draft not found';
  end if;

  if v_draft.status <> 'draft'
     or v_draft.review_status not in ('not_requested', 'changes_requested') then
    raise exception 'authoring_evidence_rejected: evidence links are locked while review is pending or complete';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  select * into v_chunk
  from public.source_chunks
  where chunk_id = new.chunk_id;

  if not found then
    raise exception 'authoring_evidence_rejected: source chunk not found';
  end if;

  if v_chunk.source_id <> new.source_id then
    raise exception 'authoring_evidence_rejected: source/chunk ownership mismatch';
  end if;

  if coalesce(v_chunk.approved, false) is not true or v_chunk.status <> 'approved' then
    raise exception 'authoring_evidence_rejected: source chunk is not approved';
  end if;

  select * into v_source
  from public.approved_sources
  where id = new.source_id;

  if not found or v_source.status <> 'approved' then
    raise exception 'authoring_evidence_rejected: source is not approved';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_scenario_authoring_evidence_link()
  from public, anon, authenticated;
grant execute on function private.enforce_scenario_authoring_evidence_link()
  to service_role;

drop trigger if exists enforce_scenario_authoring_evidence_link
  on public.scenario_authoring_draft_evidence;

create trigger enforce_scenario_authoring_evidence_link
before insert or update or delete on public.scenario_authoring_draft_evidence
for each row
execute function private.enforce_scenario_authoring_evidence_link();

comment on table public.scenario_authoring_draft_evidence is
  'Private author-draft links to approved governed source chunks. Linkage is evidence metadata only and does not publish or grant assessment eligibility.';
