-- Enforce least-privilege table access on the public schema.
--
-- Supabase's default privileges grant `anon`, `authenticated` and `service_role`
-- the full `arwdDxtm` set on every table created in `public`. That was verified
-- against `pg_default_acl` in a disposable Supabase PostgreSQL 17 instance:
--
--   postgres|public|r|{postgres=arwdDxtm,anon=arwdDxtm,authenticated=arwdDxtm,service_role=arwdDxtm}
--   supabase_admin|public|r|{postgres=arwdDxtm,anon=arwdDxtm,authenticated=arwdDxtm,service_role=arwdDxtm}
--
-- The canonical chain revoked selectively, so after applying all 106 migrations
-- 11 tables still carried the full set for `anon` and 15 for `authenticated`,
-- including TRUNCATE, REFERENCES and TRIGGER, which no client operation needs.
--
-- This migration restores the reviewed policy in
-- docs/database/table-access-policy.json:
--
--   * `anon` holds no table privilege anywhere in `public`;
--   * `authenticated` holds exactly the privileges the canonical chain granted;
--   * the six tables with no client-facing consumer become service-role-only;
--   * new tables no longer inherit broad client grants.
--
-- Row-level security is deliberately untouched: it is a separate control, and a
-- policy never substitutes for an appropriate table privilege.
--
-- Idempotent: every statement is a REVOKE or GRANT, so re-application is safe.
-- No data is read, written or deleted.

begin;

-- 1. No anonymous table access anywhere in `public`. No canonical migration
--    grants `anon` a table privilege, and no client consumer reads these tables
--    anonymously; access is mediated by the Worker and edge functions, which use
--    the service role.
revoke all on all tables in schema public from anon;

-- 2. Rebuild the authenticated grants from the canonical chain exactly.
--    `20260924052734_restore_classroom_api_schema.sql` is the authority for the
--    classroom tables, `20260918203224_profiles.sql` for profiles,
--    `20260823041129_harden_syllabus_table_privileges.sql` for the syllabus and
--    scenario-catalog tables.
revoke all on all tables in schema public from authenticated;

grant select, insert, update, delete on table public.classes to authenticated;
grant select, insert on table public.enrollments to authenticated;
grant select, insert on table public.replays to authenticated;
grant select, insert on table public.completions to authenticated;
grant select, insert on table public.assignments to authenticated;
grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.syllabi to authenticated;
grant select, insert, update, delete on table public.syllabus_scenarios to authenticated;
grant select on table public.scenario_catalog to authenticated;

-- 3. Service-role-only baseline for the tables with no client-facing consumer.
--    `telemetry_events` already carries four deny-all RLS policies for
--    `anon, authenticated`; `competency_areas` is read only by
--    worker/routes/scenario-questions-approved.js; the remaining four have no
--    consumer in worker/, src/, supabase/functions/ or exam-site/.
revoke all on table public.competency_areas from anon, authenticated;
revoke all on table public.competency_to_program_map from anon, authenticated;
revoke all on table public.diagnostic_data_domains from anon, authenticated;
revoke all on table public.external_data_resources from anon, authenticated;
revoke all on table public.external_resource_domain_links from anon, authenticated;
revoke all on table public.telemetry_events from anon, authenticated;

-- 4. Stop future tables from inheriting broad client grants.
--
-- Only the *current* migration role's defaults can be changed here, and only
-- for roles the migration role is a member of. Verified in a disposable
-- Supabase PostgreSQL 17 instance:
--
--   supabase_admin: superuser, and `postgres` is NOT a member of it
--   postgres:       non-superuser, CREATEROLE, member of anon/authenticated/service_role
--
-- so `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` is refused with
-- SQLSTATE 42501, which is exactly how the Supabase preview deployment failed.
-- Supabase manages supabase_admin; a project migration must not assume
-- authority over it.
--
-- The broad defaults that affect application tables are per-schema entries on
-- `public` held by the migration role, so the implicit current-role form is both
-- sufficient and the least privileged option available. It targets whichever
-- role actually runs migrations, so it does not depend on naming that role.
--
-- Platform-managed residual, recorded rather than papered over: supabase_admin
-- also holds per-schema `public` defaults granting anon/authenticated the full
-- set. A project migration cannot change them. They only take effect for objects
-- created *by supabase_admin*, and the platform does not use that role to create
-- application tables, so this is a documented boundary rather than a gap this
-- migration can close. See docs/database/least-privilege-migration-security-note.md.
alter default privileges in schema public revoke all on tables from anon, authenticated;

commit;
