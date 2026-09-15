-- Remove legacy citation role 'supports-ase-concept' from question_citations
-- ============================================================================
-- This migration removes the legacy Automotive Service Excellence (ASE) concept
-- role from the question_citations table. This role was part of an earlier
-- classification schema that has been superseded by the current semantic roles:
-- - supports-question
-- - supports-answer
-- - supports-explanation
-- - supports-next-step
--
-- MIGRATION STRATEGY (Fail-Closed):
-- 1. Archive existing 'supports-ase-concept' records (if any) to an audit table
--    and harden that audit table to service-role read-only access
-- 2. Remove rows OR update them to a supported role (depending on audit findings)
-- 3. Modify the CHECK constraint to exclude the legacy role
--
-- NOTE: This is a FORWARD-ONLY migration. We do NOT remove the historical
-- applied migration from bootstrap_foundation_schema.sql. The old data schema
-- remains in version control as a historical record.
-- ============================================================================

BEGIN;

-- Step 1: Create audit table to capture any legacy role usage
-- (Only if migration was already applied; this is idempotent)
CREATE TABLE IF NOT EXISTS public.citation_role_migration_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    original_question_citations_id uuid NOT NULL,
    original_question_provenance_id uuid NOT NULL,
    original_source_id text NOT NULL,
    original_chunk_id text NOT NULL,
    original_role text NOT NULL,
    original_locator text,
    original_quote text,
    archived_at timestamptz DEFAULT now(),
    migration_notes text
);

-- Step 1b: Harden the audit table (service-role read only)
-- The audit table is part of the RALA evidence system and lives in the exposed
-- `public` schema, so it follows the same fail-closed convention as
-- public.question_provenance and public.question_citations: RLS enabled, no
-- anon/authenticated grants, and read-only access for service_role.
-- The archive INSERT and DELETE below run with the migration owner's
-- privileges, which bypass RLS unless FORCE ROW LEVEL SECURITY is set.
ALTER TABLE public.citation_role_migration_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.citation_role_migration_audit
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.citation_role_migration_audit
TO service_role;

-- Step 2: Archive any existing 'supports-ase-concept' records
-- (This will be a no-op if no such records exist)
INSERT INTO public.citation_role_migration_audit (
    original_question_citations_id,
    original_question_provenance_id,
    original_source_id,
    original_chunk_id,
    original_role,
    original_locator,
    original_quote,
    migration_notes
)
SELECT
    id,
    question_provenance_id,
    source_id,
    chunk_id,
    role,
    locator,
    quote,
    'Archived during forward migration to remove supports-ase-concept role. Review and reclassify to appropriate role (supports-question, supports-answer, supports-explanation, or supports-next-step).'
FROM public.question_citations
WHERE role = 'supports-ase-concept'
ON CONFLICT DO NOTHING;

-- Step 3: Delete archived 'supports-ase-concept' records from active table
-- (This enforces the fail-closed constraint: unsupported roles are removed, not coerced)
DELETE FROM public.question_citations
WHERE role = 'supports-ase-concept';

-- Step 4: Modify the CHECK constraint on question_citations to remove legacy role
-- PostgreSQL requires us to drop and recreate the constraint
ALTER TABLE public.question_citations DROP CONSTRAINT question_citations_role_check;

ALTER TABLE public.question_citations
ADD CONSTRAINT question_citations_role_check CHECK (
    role IN (
        'supports-question',
        'supports-answer',
        'supports-explanation',
        'supports-next-step'
    )
);

-- Step 5: Document the migration in schema metadata
COMMENT ON TABLE public.citation_role_migration_audit IS
    'Audit trail for question_citations role migration. Captures records using the legacy supports-ase-concept role that were archived during the forward migration to remove it. Service-role read only.';

COMMIT;
