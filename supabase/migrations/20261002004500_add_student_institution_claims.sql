-- Student institution selection captured during account creation.
-- This is a self-asserted association only; it never proves enrollment or grants
-- privileges beyond the student role.

create table if not exists public.student_institution_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_code text not null references public.institutions(school_code),
  status text not null default 'claimed'
    check (status in ('claimed','verified','rejected')),
  claimed_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  verification_note text,
  constraint student_institution_claims_review_metadata check (
    (status = 'claimed' and verified_at is null and verified_by is null)
    or
    (status in ('verified','rejected') and verified_at is not null and verified_by is not null)
  )
);

alter table public.student_institution_claims enable row level security;
revoke all on table public.student_institution_claims from public, anon, authenticated;
grant all on table public.student_institution_claims to service_role;

comment on table public.student_institution_claims is
  'Student-selected institution association. A claimed row is not enrollment proof and cannot grant elevated access.';

create or replace function public.capture_student_institution_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_school_code text;
begin
  if coalesce(new.raw_user_meta_data->>'account_type', '') <> 'student' then
    return new;
  end if;

  requested_school_code := upper(trim(coalesce(new.raw_user_meta_data->>'school_code', '')));

  if requested_school_code = '' then
    return new;
  end if;

  if exists (
    select 1
    from public.institutions i
    where i.school_code = requested_school_code
      and i.active = true
  ) then
    insert into public.student_institution_claims (
      user_id,
      school_code,
      status,
      claimed_at
    )
    values (
      new.id,
      requested_school_code,
      'claimed',
      now()
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_student_institution on auth.users;

create trigger on_auth_user_created_student_institution
after insert on auth.users
for each row execute function public.capture_student_institution_claim();
