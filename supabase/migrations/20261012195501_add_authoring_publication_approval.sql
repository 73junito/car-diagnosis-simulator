-- G7 explicit authoring publication approval.
-- Publication approval requires completed review and governed evidence.
-- Publication never grants learner delivery, scoring, or assessment eligibility.

alter table public.scenario_authoring_drafts
  add column if not exists publication_status text not null default 'unpublished',
  add column if not exists publication_requested_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id),
  add column if not exists publication_note text;

alter table public.scenario_authoring_drafts
  drop constraint if exists scenario_authoring_drafts_publication_status_check;

alter table public.scenario_authoring_drafts
  add constraint scenario_authoring_drafts_publication_status_check
  check (publication_status in ('unpublished', 'pending', 'changes_requested', 'published'));

alter table public.scenario_authoring_drafts
  drop constraint if exists scenario_authoring_drafts_publication_note_check;

alter table public.scenario_authoring_drafts
  add constraint scenario_authoring_drafts_publication_note_check
  check (publication_note is null or char_length(publication_note) <= 2000);

alter table public.scenario_authoring_drafts
  drop constraint if exists scenario_authoring_drafts_publication_review_gate_check;

alter table public.scenario_authoring_drafts
  add constraint scenario_authoring_drafts_publication_review_gate_check
  check (
    (publication_status not in ('pending', 'published') or review_status = 'review_complete')
    and (publication_status <> 'changes_requested' or review_status = 'changes_requested')
  );

create table if not exists public.scenario_authoring_publication_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.scenario_authoring_drafts(id),
  actor_id uuid references auth.users(id),
  from_status text not null
    check (from_status in ('unpublished', 'pending', 'changes_requested', 'published')),
  to_status text not null
    check (to_status in ('unpublished', 'pending', 'changes_requested', 'published')),
  note text,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 2000)
);

create index if not exists scenario_authoring_publication_events_draft_created_idx
  on public.scenario_authoring_publication_events (draft_id, created_at desc);

alter table public.scenario_authoring_publication_events enable row level security;

revoke all on table public.scenario_authoring_publication_events
  from public, anon, authenticated, service_role;
grant select, insert on table public.scenario_authoring_publication_events
  to service_role;

create or replace function private.enforce_scenario_authoring_publication_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_evidence_count integer;
begin
  if new.publication_status is not distinct from old.publication_status then
    return new;
  end if;

  if old.publication_status = 'published' then
    raise exception 'authoring_publication_rejected: published state is terminal';
  end if;

  if old.publication_status = 'unpublished' and new.publication_status <> 'pending' then
    raise exception 'authoring_publication_rejected: unpublished drafts may only request publication';
  end if;

  if old.publication_status = 'pending'
     and new.publication_status not in ('changes_requested', 'published') then
    raise exception 'authoring_publication_rejected: pending publication requires an admin decision';
  end if;

  if old.publication_status = 'changes_requested'
     and new.publication_status <> 'unpublished' then
    raise exception 'authoring_publication_rejected: publication changes must return to an unpublished draft';
  end if;

  if new.publication_status in ('pending', 'published')
     and new.review_status <> 'review_complete' then
    raise exception 'authoring_publication_rejected: completed review required';
  end if;

  if new.publication_status = 'pending' then
    select count(*)::integer
      into v_evidence_count
    from public.scenario_authoring_draft_evidence
    where draft_id = new.id;

    if v_evidence_count < 1 then
      raise exception 'authoring_publication_rejected: at least one governed evidence link is required';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_scenario_authoring_publication_transition()
  from public, anon, authenticated;
grant execute on function private.enforce_scenario_authoring_publication_transition()
  to service_role;

drop trigger if exists enforce_scenario_authoring_publication_transition
  on public.scenario_authoring_drafts;

create trigger enforce_scenario_authoring_publication_transition
before update of publication_status, review_status on public.scenario_authoring_drafts
for each row
execute function private.enforce_scenario_authoring_publication_transition();

create or replace function private.capture_scenario_authoring_publication_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.publication_status is distinct from old.publication_status then
    insert into public.scenario_authoring_publication_events (
      draft_id,
      actor_id,
      from_status,
      to_status,
      note,
      created_at
    )
    values (
      new.id,
      case
        when new.publication_status in ('pending', 'unpublished') then new.owner_id
        else new.published_by
      end,
      old.publication_status,
      new.publication_status,
      new.publication_note,
      now()
    );
  end if;
  return new;
end;
$$;

revoke all on function private.capture_scenario_authoring_publication_event()
  from public, anon, authenticated;
grant execute on function private.capture_scenario_authoring_publication_event()
  to service_role;

drop trigger if exists capture_scenario_authoring_publication_event
  on public.scenario_authoring_drafts;

create trigger capture_scenario_authoring_publication_event
after update of publication_status on public.scenario_authoring_drafts
for each row
execute function private.capture_scenario_authoring_publication_event();

comment on column public.scenario_authoring_drafts.publication_status is
  'Explicit human publication approval state. Published does not grant learner delivery, scoring, or assessment eligibility.';

comment on table public.scenario_authoring_publication_events is
  'Append-only publication approval evidence. It has no learner-delivery or assessment-eligibility effect.';
