-- G9 governed student institution-claim review.
-- Claims remain self-asserted until verified by an authorized reviewer.
-- Only verified claims may establish an active institution member relationship.

create table if not exists public.student_institution_claim_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_code text not null references public.institutions(school_code),
  actor_id uuid references auth.users(id),
  action text not null check (action in ('verified', 'rejected')),
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists student_institution_claim_events_user_created_idx
  on public.student_institution_claim_events (user_id, created_at desc);

create index if not exists student_institution_claim_events_school_created_idx
  on public.student_institution_claim_events (school_code, created_at desc);

alter table public.student_institution_claim_events enable row level security;

revoke all on table public.student_institution_claim_events
  from public, anon, authenticated, service_role;

grant select, insert on table public.student_institution_claim_events to service_role;

create or replace function private.apply_verified_student_institution_claim()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.institution_memberships%rowtype;
  v_role text;
begin
  if old.status = 'claimed' and new.status = 'verified' then
    if new.verified_by is null or new.verified_at is null then
      raise exception 'student_institution_claim_rejected: verified claim requires reviewer metadata';
    end if;

    select *
      into v_existing
    from public.institution_memberships membership
    where membership.school_code = new.school_code
      and membership.user_id = new.user_id
    for update;

    if found then
      v_role := case
        when v_existing.role = 'institution_owner' then 'institution_owner'
        when v_existing.role = 'institution_admin' then 'institution_admin'
        when v_existing.role = 'instructor' then 'instructor'
        else 'member'
      end;

      update public.institution_memberships
      set role = v_role,
          status = 'active',
          updated_by = new.verified_by,
          updated_at = now()
      where id = v_existing.id;
    else
      insert into public.institution_memberships (
        school_code,
        user_id,
        role,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) values (
        new.school_code,
        new.user_id,
        'member',
        'active',
        new.verified_by,
        new.verified_by,
        now(),
        now()
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.apply_verified_student_institution_claim()
  from public, anon, authenticated;
grant execute on function private.apply_verified_student_institution_claim()
  to service_role;

drop trigger if exists apply_verified_student_institution_claim
  on public.student_institution_claims;

create trigger apply_verified_student_institution_claim
before update of status on public.student_institution_claims
for each row
execute function private.apply_verified_student_institution_claim();

create or replace function private.capture_student_institution_claim_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'claimed'
     and new.status in ('verified', 'rejected')
     and old.status is distinct from new.status then
    insert into public.student_institution_claim_events (
      user_id,
      school_code,
      actor_id,
      action,
      review_note
    ) values (
      new.user_id,
      new.school_code,
      new.verified_by,
      new.status,
      new.verification_note
    );
  end if;

  return new;
end;
$$;

revoke all on function private.capture_student_institution_claim_event()
  from public, anon, authenticated;
grant execute on function private.capture_student_institution_claim_event()
  to service_role;

drop trigger if exists capture_student_institution_claim_event
  on public.student_institution_claims;

create trigger capture_student_institution_claim_event
after update of status on public.student_institution_claims
for each row
execute function private.capture_student_institution_claim_event();

comment on table public.student_institution_claim_events is
  'Append-only reviewer evidence for terminal student institution-claim decisions.';

comment on table public.student_institution_claims is
  'Student-selected institution association. Claimed status is self-asserted only. Verified status requires authorized human review and may establish a basic institution member relationship; it never grants instructor/admin roles or assessment eligibility.';
