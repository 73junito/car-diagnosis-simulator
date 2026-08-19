-- Staging Fixtures: Question Provenance
-- Purpose: Link actual scenario_questions (by UUID) to provenance records
-- Maps all no-crank questions to provenance records
-- Follows lifecycle: draft → validated → approved
--
-- CRITICAL: Provenance must remain 'validated' until BOTH citation roles exist:
-- - supports-answer: answer is directly supported by source excerpt
-- - supports-explanation: explanation is supported by source excerpt
--
-- Only after citation_validations confirm both roles should provenance transition to 'approved'.
-- This is a fail-closed design: missing citations = no questions served to students.

-- Step 1: Idempotent insert - Create provenance records for all no-crank questions (as draft)
-- Only inserts if provenance does not already exist for this version
-- Prevents destructive deletes that would cascade to citations and validations
INSERT INTO public.question_provenance (
  question_id,
  provenance_version,
  status,
  validation_checklist
)
SELECT
  sq.id::text,  -- Convert UUID to text for storage
  1 as provenance_version,
  'draft' as status,
  '{"answer_verified": false, "explanation_verified": false, "citation_matches_excerpt": false, "license_ok": false}'::jsonb as validation_checklist
FROM public.scenario_questions sq
WHERE sq.scenario_id = 'no-crank'
  AND NOT EXISTS (
    SELECT 1
    FROM public.question_provenance qp
    WHERE qp.question_id = sq.id::text
      AND qp.provenance_version = 1
  )
ORDER BY sq.created_at;

-- Step 2: DO NOT AUTO-TRANSITION
-- Provenance must remain 'draft' until evidence review is complete.
-- A separate, evidence-reviewed operation should truthfully populate validation_checklist
-- and transition the record to 'validated' before validator runs.
--
-- This is intentionally commented out to prevent premature lifecycle advancement:
-- UPDATE public.question_provenance
-- SET validation_checklist = '...truthfully reviewed values...',
--     status = 'validated'
-- WHERE question_id IN (...) AND status = 'draft';

-- Step 3: COMPLETE LIFECYCLE (when evidence is ready)
-- 1. Evidence documents collected and hashes computed
-- 2. Citations manually mapped and reviewed
-- 3. Reviewer truthfully completes validation_checklist
-- 4. Promote to validated with truthful checklist:
--    UPDATE public.question_provenance
--    SET validation_checklist = '{"answer_verified": true, "explanation_verified": true, ...}'::jsonb,
--        status = 'validated',
--        reviewed_by = 'reviewer-id',
--        reviewed_at = NOW()
--    WHERE question_id IN (...) AND status = 'draft';
-- 5. Validator runs on status IN ('validated', 'approved')
-- 6. Validator writes citation_validations records (result='valid' or 'invalid')
-- 7. Operator promotes only where citation_validations.result = 'valid':
--    UPDATE public.question_provenance
--    SET status = 'approved'
--    WHERE id IN (
--      SELECT question_provenance_id FROM public.citation_validations
--      WHERE result = 'valid'
--    ) AND status = 'validated';
-- 8. Endpoint serves only where status='approved' AND citation_validations.result='valid'

-- Verify inserts
SELECT COUNT(*) as fixture_provenance_created FROM public.question_provenance
WHERE question_id IN (
  SELECT id::text FROM public.scenario_questions
  WHERE scenario_id = 'no-crank'
) AND status = 'draft';
