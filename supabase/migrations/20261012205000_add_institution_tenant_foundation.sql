-- G8 institution tenant foundation.
-- Institution identifiers are directory metadata only; active membership is the
-- authorization object for institution-scoped programs, cohorts, and classes.

create table if not exists public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  school_code text not null references public.institutions(school_code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null
    check (role in ('member', 'instructor', 'institution_admin', 'institution_owner')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_code, user_id)
);

create index if not exists institution_memberships_user_status_idx
  on public.institution_memberships (user_id, status, school_code);

create index if not exists institution_memberships_school_role_idx
  on public.institution_memberships (school_code, role, status);

create table if not exists public.institution_programs (
  id uuid primary key default gen_random_uuid(),
  school_code text not null references public.institutions(school_code) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  code text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_code),
  unique (school_code, name)
);

create index if not exists institution_programs_school_active_idx
  on public.institution_programs (school_code, active, name);

create table if not exists public.institution_cohorts (
  id uuid primary key default gen_random_uuid(),
  school_code text not null references public.institutions(school_code) on delete cascade,
  program_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  starts_on date,
  ends_on date,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_code),
  unique (school_code, name),
  constraint institution_cohorts_date_order
    check (starts_on is null or ends_on is null or starts_on <= ends_on),
  constraint institution_cohorts_program_tenant_fkey
    foreign key (program_id, school_code)
    references public.institution_programs(id, school_code)
    on delete restrict
);

create index if not exists institution_cohorts_school_active_idx
  on public.institution_cohorts (school_code, active, name);

alter table public.classes
  add column if not exists institution_school_code text references public.institutions(school_code),
  add column if not exists institution_program_id uuid references public.institution_programs(id),
  add column if not exists institution_cohort_id uuid references public.institution_cohorts(id);

create index if not exists classes_institution_school_idx
  on public.classes (institution_school_code, created_at desc);

alter table public.institution_memberships enable row level security;
alter table public.institution_programs enable row level security;
alter table public.institution_cohorts enable row level security;

revoke all on table public.institution_memberships
  from public, anon, authenticated, service_role;
revoke all on table public.institution_programs
  from public, anon, authenticated, service_role;
revoke all on table public.institution_cohorts
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.institution_memberships to service_role;
grant select, insert, update, delete on table public.institution_programs to service_role;
grant select, insert, update, delete on table public.institution_cohorts to service_role;

create or replace function private.sync_approved_instructor_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.institution_memberships (
      school_code,
      user_id,
      role,
      status,
      created_by,
      created_at,
      updated_at
    )
    values (
      new.school_code,
      new.user_id,
      'instructor',
      'active',
      new.reviewed_by,
      now(),
      now()
    )
    on conflict (school_code, user_id) do update
      set role = case
            when public.institution_memberships.role = 'member' then 'instructor'
            else public.institution_memberships.role
          end,
          status = 'active',
          updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function private.sync_approved_instructor_membership()
  from public, anon, authenticated;
grant execute on function private.sync_approved_instructor_membership()
  to service_role;

drop trigger if exists sync_approved_instructor_membership
  on public.instructor_verification_requests;

create trigger sync_approved_instructor_membership
after insert or update of status on public.instructor_verification_requests
for each row
execute function private.sync_approved_instructor_membership();

insert into public.institution_memberships (
  school_code,
  user_id,
  role,
  status,
  created_by,
  created_at,
  updated_at
)
select
  request.school_code,
  request.user_id,
  'instructor',
  'active',
  request.reviewed_by,
  coalesce(request.reviewed_at, request.requested_at, now()),
  now()
from public.instructor_verification_requests request
where request.status = 'approved'
on conflict (school_code, user_id) do update
  set role = case
        when public.institution_memberships.role = 'member' then 'instructor'
        else public.institution_memberships.role
      end,
      status = 'active',
      updated_at = now();

create or replace function private.enforce_class_institution_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_program_school text;
  v_cohort_school text;
  v_cohort_program uuid;
begin
  if new.institution_school_code is null then
    if new.institution_program_id is not null or new.institution_cohort_id is not null then
      raise exception 'institution_scope_rejected: program/cohort requires institution';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.institution_memberships membership
    where membership.school_code = new.institution_school_code
      and membership.user_id = new.owner_id
      and membership.status = 'active'
      and membership.role in ('instructor', 'institution_admin', 'institution_owner')
  ) then
    raise exception 'institution_scope_rejected: class owner lacks active institution membership';
  end if;

  if new.institution_program_id is not null then
    select school_code
      into v_program_school
    from public.institution_programs
    where id = new.institution_program_id;

    if v_program_school is null or v_program_school <> new.institution_school_code then
      raise exception 'institution_scope_rejected: program belongs to another institution';
    end if;
  end if;

  if new.institution_cohort_id is not null then
    select school_code, program_id
      into v_cohort_school, v_cohort_program
    from public.institution_cohorts
    where id = new.institution_cohort_id;

    if v_cohort_school is null or v_cohort_school <> new.institution_school_code then
      raise exception 'institution_scope_rejected: cohort belongs to another institution';
    end if;

    if new.institution_program_id is not null
       and v_cohort_program is distinct from new.institution_program_id then
      raise exception 'institution_scope_rejected: cohort belongs to another program';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_class_institution_scope()
  from public, anon, authenticated;
grant execute on function private.enforce_class_institution_scope()
  to service_role, authenticated;

drop trigger if exists enforce_class_institution_scope on public.classes;

create trigger enforce_class_institution_scope
before insert or update of owner_id, institution_school_code, institution_program_id, institution_cohort_id
on public.classes
for each row
execute function private.enforce_class_institution_scope();

update public.classes class
set institution_school_code = request.school_code
from public.instructor_verification_requests request
where class.institution_school_code is null
  and request.user_id = class.owner_id
  and request.status = 'approved';

comment on table public.institution_memberships is
  'Institution authorization boundary. Directory records, domains, and school-code matches never grant institution access without an active membership row.';

comment on table public.institution_programs is
  'Tenant-scoped institution program directory. Managed only through trusted server-side service-role workflows.';

comment on table public.institution_cohorts is
  'Tenant-scoped institution cohort directory. Managed only through trusted server-side service-role workflows.';

comment on column public.classes.institution_school_code is
  'Optional institution tenant scope. When present, the class owner must hold an active instructor/admin/owner membership in the same institution.';
