-- G7 authoring draft lifecycle: review state + append-only review evidence.
-- Review completion does not publish content or grant training/assessment eligibility.

alter table public.scenario_authoring_drafts
  add column if not exists review_status text not null default 'not_requested',
  add column if not exists review_requested_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists review_note text;

alter table public.scenario_authoring_drafts
  drop constraint if exists scenario_authoring_drafts_review_status_check;

alter table public.scenario_authoring_drafts
  add constraint scenario_authoring_drafts_review_status_check
  check (review_status in ('not_requested', 'pending', 'changes_requested', 'review_complete'));

alter table public.scenario_authoring_drafts
  drop constraint if exists scenario_authoring_drafts_review_note_check;

alter table public.scenario_authoring_drafts
  add constraint scenario_authoring_drafts_review_note_check
  check (review_note is null or char_length(review_note) <= 2000);

create table if not exists public.scenario_authoring_draft_review_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.scenario_authoring_drafts(id),
  from_status text not null,
  to_status text not null,
  actor_id uuid not null references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  check (from_status in ('not_requested', 'pending', 'changes_requested', 'review_complete')),
  check (to_status in ('pending', 'changes_requested', 'review_complete')),
  check (note is null or char_length(note) <= 2000)
);

create index if not exists scenario_authoring_draft_review_events_draft_created_idx
  on public.scenario_authoring_draft_review_events (draft_id, created_at desc);

alter table public.scenario_authoring_draft_review_events enable row level security;

revoke all on table public.scenario_authoring_draft_review_events
  from public, anon, authenticated, service_role;
grant select, insert on table public.scenario_authoring_draft_review_events
  to service_role;

create schema if not exists private;

create or replace function private.capture_scenario_authoring_review_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.review_status is distinct from new.review_status then
    insert into public.scenario_authoring_draft_review_events (
      draft_id,
      from_status,
      to_status,
      actor_id,
      note,
      created_at
    )
    values (
      new.id,
      old.review_status,
      new.review_status,
      coalesce(new.reviewed_by, new.owner_id),
      new.review_note,
      now()
    );
  end if;
  return new;
end;
$$;

revoke all on function private.capture_scenario_authoring_review_event() from public, anon, authenticated;
grant execute on function private.capture_scenario_authoring_review_event() to service_role;

drop trigger if exists capture_scenario_authoring_review_event
  on public.scenario_authoring_drafts;

create trigger capture_scenario_authoring_review_event
after update of review_status on public.scenario_authoring_drafts
for each row
when (old.review_status is distinct from new.review_status)
execute function private.capture_scenario_authoring_review_event();

comment on column public.scenario_authoring_drafts.review_status is
  'Governed draft-review state only. review_complete does not imply publication, learner delivery, or assessment eligibility.';

comment on table public.scenario_authoring_draft_review_events is
  'Append-only review lifecycle evidence for private scenario drafts. It has no publication or assessment eligibility effect.';
