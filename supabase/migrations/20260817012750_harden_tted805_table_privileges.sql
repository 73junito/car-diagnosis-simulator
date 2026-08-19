-- Migration: Harden TTED805 table privileges
-- Purpose: Enforce service-role-only access per Supabase 2026 default behavior change
-- Context: Supabase no longer automatically restricts table_privileges. This migration
--          explicitly hardens attempts, citation_validations, and attempt_answers to
--          service-role only, regardless of Supabase's initialization defaults.
-- Reference: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

BEGIN;

-- ============================================================================
-- Harden public.attempts
-- ============================================================================
-- Revoke all access by default
REVOKE ALL ON public.attempts FROM anon, authenticated;

-- Grant only what service_role needs: SELECT, INSERT, UPDATE
-- (no DELETE—attempts audit trail is immutable)
GRANT SELECT, INSERT, UPDATE ON public.attempts TO service_role;

-- ============================================================================
-- Harden public.citation_validations
-- ============================================================================
-- Revoke all access by default
REVOKE ALL ON public.citation_validations FROM anon, authenticated;

-- Grant only what service_role needs: SELECT, INSERT, UPDATE
-- (no DELETE—validation records are immutable evidence)
GRANT SELECT, INSERT, UPDATE ON public.citation_validations TO service_role;

-- ============================================================================
-- Harden public.attempt_answers
-- ============================================================================
-- Revoke all access by default
REVOKE ALL ON public.attempt_answers FROM anon, authenticated;

-- Grant only what service_role needs: SELECT, INSERT
-- (no UPDATE or DELETE—answer audit trail is immutable)
GRANT SELECT, INSERT ON public.attempt_answers TO service_role;

COMMIT;

COMMENT ON SCHEMA public IS
  'TTED805 hardening applied. All TTED805 tables require service_role for access.';
