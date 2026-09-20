create table public.profiles (
    id uuid primary key,
    email text,
    role text
);

alter table public.profiles
    enable row level security;

revoke all on table public.profiles from public;
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);
