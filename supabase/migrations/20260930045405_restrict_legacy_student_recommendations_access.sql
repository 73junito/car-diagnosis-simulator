-- P0.5 follow-up: remove direct public access to the legacy recommendation table.
-- Fresh Supabase preview branches may not contain this legacy asset; do not recreate it.
-- The server-side recommendation boundary uses service-role access when the table exists.

do $$
begin
  if to_regclass('public.student_recommendations') is not null then
    execute 'alter table public.student_recommendations enable row level security';
    execute 'drop policy if exists "Public can read student recommendations" on public.student_recommendations';
    execute 'revoke all privileges on table public.student_recommendations from anon, authenticated';
    execute 'grant all privileges on table public.student_recommendations to service_role';
  end if;
end
$$;
