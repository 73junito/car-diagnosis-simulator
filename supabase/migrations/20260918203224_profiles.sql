-- Canonical profiles contract.
-- This migration is intentionally idempotent because some long-lived
-- environments already contain public.profiles from an earlier/manual rollout.

create table if not exists public.profiles (
    id uuid primary key,
    email text,
    role text not null default 'student',
    created_at timestamptz default now()
);

alter table public.profiles
    add column if not exists email text;

alter table public.profiles
    add column if not exists role text;

alter table public.profiles
    add column if not exists created_at timestamptz default now();

alter table public.profiles
    enable row level security;

revoke all on table public.profiles from public;
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
          and policyname = 'Users can read their own profile'
    ) then
        create policy "Users can read their own profile"
        on public.profiles
        for select
        to authenticated
        using (auth.uid() = id);
    end if;
end
$$;
