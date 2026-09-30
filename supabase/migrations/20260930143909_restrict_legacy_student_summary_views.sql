-- P0.5 follow-up: retire direct public access to legacy student summary views.
-- Fresh Supabase preview branches may not contain these legacy views; do not recreate them.
-- Canonical student progress is served through the authenticated application API.

do $$
begin
  if to_regclass('public.student_performance_summary') is not null then
    execute 'revoke all privileges on table public.student_performance_summary from anon, authenticated';
    execute 'grant select on table public.student_performance_summary to service_role';
  end if;

  if to_regclass('public.student_transcript_summary') is not null then
    execute 'revoke all privileges on table public.student_transcript_summary from anon, authenticated';
    execute 'grant select on table public.student_transcript_summary to service_role';
  end if;
end
$$;
