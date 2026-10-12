-- G8 institution membership administration.
-- Invitations are tenant-scoped and email-bound. Membership removal is a
-- reversible suspension; the final active institution owner cannot be removed.

create table if not exists public.institution_membership_invitations (
  id uuid primary key default gen_random_uuid(),
  school_code text not null references public.institutions(school_code) on delete cascade,
  email text not null,
  role text not null
    check (role in ('member', 'instructor', 'institution_admin', 'institution_owner')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id),
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  note text,
  constraint institution_membership_invitation_email_format
    check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint institution_membership_invitation_note_length
    check (note is null or char_length(note) <= 1000),
  constraint institution_membership_invitation_lifecycle check (
    (
      status = 'pending'
      and accepted_by is null and accepted_at is null
      and revoked_by is null and revoked_at is null
    )
    or
    (
      status = 'accepted'
      and accepted_by is not null and accepted_at is not null
      and revoked_by is null and revoked_at is null
    )
    or
    (
      status = 'revoked'
      and revoked_by is not null and revoked_at is not null
      and accepted_by is null and accepted_at is null
    )
    or
    (
      status = 'expired'
      and accepted_by is null and accepted_at is null
      and revoked_by is null and revoked_at is null
    )
  )
);

create unique index if not exists institution_membership_pending_invitation_unique_idx
  on public.institution_membership_invitations (school_code, email)
  where status = 'pending';

create index if not exists institution_membership_invitations_school_status_idx
  on public.institution_membership_invitations (school_code, status, invited_at desc);

create index if not exists institution_membership_invitations_email_status_idx
  on public.institution_membership_invitations (email, status, expires_at);

create table if not exists public.institution_membership_events (
  id uuid primary key default gen_random_uuid(),
  school_code text not null references public.institutions(school_code),
  membership_id uuid references public.institution_memberships(id),
  invitation_id uuid references public.institution_membership_invitations(id),
  actor_id uuid references auth.users(id),
  subject_user_id uuid references auth.users(id),
  subject_email text,
  action text not null
    check (action in ('invited', 'invitation_accepted', 'invitation_revoked', 'membership_suspended', 'membership_reactivated')),
  role text
    check (role is null or role in ('member', 'instructor', 'institution_admin', 'institution_owner')),
  note text,
  created_at timestamptz not null default now(),
  constraint institution_membership_event_subject check (
    subject_user_id is not null or subject_email is not null
  ),
  constraint institution_membership_event_note_length
    check (note is null or char_length(note) <= 1000)
);

create index if not exists institution_membership_events_school_created_idx
  on public.institution_membership_events (school_code, created_at desc);

alter table public.institution_membership_invitations enable row level security;
alter table public.institution_membership_events enable row level security;

revoke all on table public.institution_membership_invitations
  from public, anon, authenticated, service_role;
revoke all on table public.institution_membership_events
  from public, anon, authenticated, service_role;

grant select, insert, update on table public.institution_membership_invitations to service_role;
grant select, insert on table public.institution_membership_events to service_role;

-- Membership administration is intentionally soft-delete only.
revoke delete on table public.institution_memberships from service_role;

create or replace function private.enforce_institution_owner_floor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_active_owner_count integer;
  v_removing_owner boolean := false;
begin
  if tg_op = 'DELETE' then
    v_removing_owner := old.status = 'active' and old.role = 'institution_owner';
  else
    v_removing_owner :=
      old.status = 'active'
      and old.role = 'institution_owner'
      and not (new.status = 'active' and new.role = 'institution_owner');
  end if;

  if not v_removing_owner then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select count(*)::integer
    into v_active_owner_count
  from public.institution_memberships membership
  where membership.school_code = old.school_code
    and membership.status = 'active'
    and membership.role = 'institution_owner'
    and membership.id <> old.id;

  if v_active_owner_count < 1 then
    raise exception 'institution_membership_rejected: cannot remove the final active institution owner';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.enforce_institution_owner_floor()
  from public, anon, authenticated;
grant execute on function private.enforce_institution_owner_floor()
  to service_role;

drop trigger if exists enforce_institution_owner_floor
  on public.institution_memberships;

create trigger enforce_institution_owner_floor
before update of role, status or delete on public.institution_memberships
for each row
execute function private.enforce_institution_owner_floor();

create or replace function private.capture_institution_invitation_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.institution_membership_events (
      school_code, invitation_id, actor_id, subject_email, action, role, note
    ) values (
      new.school_code, new.id, new.invited_by, new.email, 'invited', new.role, new.note
    );
  elsif old.status is distinct from new.status and new.status = 'accepted' then
    insert into public.institution_membership_events (
      school_code, invitation_id, actor_id, subject_user_id, subject_email, action, role, note
    ) values (
      new.school_code, new.id, new.accepted_by, new.accepted_by, new.email, 'invitation_accepted', new.role, new.note
    );
  elsif old.status is distinct from new.status and new.status = 'revoked' then
    insert into public.institution_membership_events (
      school_code, invitation_id, actor_id, subject_email, action, role, note
    ) values (
      new.school_code, new.id, new.revoked_by, new.email, 'invitation_revoked', new.role, new.note
    );
  end if;

  return new;
end;
$$;

revoke all on function private.capture_institution_invitation_event()
  from public, anon, authenticated;
grant execute on function private.capture_institution_invitation_event()
  to service_role;

drop trigger if exists capture_institution_invitation_event
  on public.institution_membership_invitations;

create trigger capture_institution_invitation_event
after insert or update of status on public.institution_membership_invitations
for each row
execute function private.capture_institution_invitation_event();

create or replace function private.capture_institution_membership_status_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status is distinct from new.status and new.status = 'suspended' then
    insert into public.institution_membership_events (
      school_code, membership_id, actor_id, subject_user_id, action, role
    ) values (
      new.school_code, new.id, new.created_by, new.user_id, 'membership_suspended', new.role
    );
  elsif old.status is distinct from new.status and new.status = 'active' then
    insert into public.institution_membership_events (
      school_code, membership_id, actor_id, subject_user_id, action, role
    ) values (
      new.school_code, new.id, new.created_by, new.user_id, 'membership_reactivated', new.role
    );
  end if;

  return new;
end;
$$;

revoke all on function private.capture_institution_membership_status_event()
  from public, anon, authenticated;
grant execute on function private.capture_institution_membership_status_event()
  to service_role;

comment on table public.institution_membership_invitations is
  'Tenant-scoped email-bound invitations. A directory match or invitation alone does not grant institution access until the matching authenticated user accepts and an active membership is created.';

comment on table public.institution_membership_events is
  'Append-only institution membership administration audit evidence.';
