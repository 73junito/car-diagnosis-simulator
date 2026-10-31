-- Minimal Supabase compatibility shim for the disposable LMF verification databases.
--
-- Applied once per throwaway database by .github/workflows/lmf-db-verification.yml before the
-- LMF migrations. It exists because those migrations are written against a Supabase project,
-- which supplies the anon/authenticated/service_role roles, the auth schema, auth.users and the
-- auth.uid()/auth.jwt() helpers. A bare PostgreSQL container provides none of them.
--
-- This file creates no application objects, is idempotent, and is never applied to Supabase.
-- The shape mirrors the existing in-repo shim at tests/r22/pglite-rls-harness.mjs.

-- Roles are cluster-scoped, so each guard is skipped on the second database.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);

create or replace function auth.uid() returns uuid language sql stable as $fn$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$fn$;

create or replace function auth.jwt() returns jsonb language sql stable as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;
