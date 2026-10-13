-- Admin review audit for instructor affiliation verification.
-- Decisions are made only by the server-side admin route. Approval does not grant a role.

create table if not exists public.instructor_verification_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.instructor_verification_requests(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  school_code text not null references public.institutions(school_code) on delete restrict,
  decision text not null check (decision in ('approved','rejected')),
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null,
  review_note text,
  created_at timestamptz not null default now(),
  unique (request_id)
);

create index if not exists instructor_verification_decisions_reviewer_idx
  on public.instructor_verification_decisions(reviewed_by, reviewed_at desc);

alter table public.instructor_verification_decisions enable row level security;
revoke all on table public.instructor_verification_decisions from public, anon, authenticated;
grant select, insert on table public.instructor_verification_decisions to service_role;

create or replace function public.capture_instructor_verification_decision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status <> 'pending' then
    raise exception 'Instructor verification decisions are final';
  end if;

  if new.status not in ('approved','rejected') then
    raise exception 'Pending instructor verification may only transition to approved or rejected';
  end if;

  if new.reviewed_by is null or new.reviewed_at is null then
    raise exception 'Reviewer identity and timestamp are required';
  end if;

  insert into public.instructor_verification_decisions (
    request_id,
    user_id,
    school_code,
    decision,
    reviewed_by,
    reviewed_at,
    review_note
  ) values (
    new.id,
    new.user_id,
    new.school_code,
    new.status,
    new.reviewed_by,
    new.reviewed_at,
    new.review_note
  );

  return new;
end;
$$;

revoke all on function public.capture_instructor_verification_decision() from public, anon, authenticated;
grant execute on function public.capture_instructor_verification_decision() to service_role;

create or replace function public.prevent_instructor_verification_decision_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'Instructor verification decision audit rows are immutable';
end;
$$;

revoke all on function public.prevent_instructor_verification_decision_mutation() from public, anon, authenticated;
grant execute on function public.prevent_instructor_verification_decision_mutation() to service_role;

drop trigger if exists capture_instructor_verification_decision_trg
  on public.instructor_verification_requests;
create trigger capture_instructor_verification_decision_trg
after update of status on public.instructor_verification_requests
for each row
when (old.status is distinct from new.status)
execute function public.capture_instructor_verification_decision();

drop trigger if exists prevent_instructor_verification_decision_mutation_trg
  on public.instructor_verification_decisions;
create trigger prevent_instructor_verification_decision_mutation_trg
before update or delete on public.instructor_verification_decisions
for each row
execute function public.prevent_instructor_verification_decision_mutation();

comment on table public.instructor_verification_decisions is
  'Append-only audit evidence for admin instructor-affiliation approval or rejection decisions.';
