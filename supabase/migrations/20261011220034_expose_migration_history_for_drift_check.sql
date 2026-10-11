-- Service-role-only migration history for deterministic environment drift checks.
-- Exposes only migration version and name; no migration SQL or application data.

create or replace function public.app_migration_history()
returns table(version text, name text)
language sql
security definer
set search_path = pg_catalog
as $$
  select m.version, m.name
  from supabase_migrations.schema_migrations as m
  order by m.version;
$$;

revoke all on function public.app_migration_history() from public, anon, authenticated;
grant execute on function public.app_migration_history() to service_role;

comment on function public.app_migration_history() is
  'Service-role-only migration history for CI drift detection; exposes version and name only.';
