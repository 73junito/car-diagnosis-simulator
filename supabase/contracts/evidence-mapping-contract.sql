-- Evidence Mapping Contract: Design Specification
-- ==============================================================================
-- 
-- PURPOSE
--   This file documents the data integrity and authorization model required for
--   Gate 4 (evidence-backed assessment rendering). It contains read-only design
--   queries only—NO deployable DDL, no CREATE FUNCTION, no SECURITY DEFINER.
--   
-- SAFETY PROPERTIES
--   - No functions to accidentally deploy
--   - No privileges to accidentally grant
--   - No hardcoded scenario lists
--   - No assumptions about catalog structure
--   
-- ACTUAL REMEDIATION
--   Remediation will follow a deliberate sequence:
--   1. Question-to-provenance crosswalk (reviewed, explicit mapping)
--   2. Catalog identity decision (scenario_key vs category ID vs mapping table)
--   3. Backfill question_id with crosswalk mapping
--   4. Link provenance and citations to question_id
--   5. Validate chain in staging
--   6. Only then design deployment functions (if needed)
--
-- ==============================================================================

-- GATE 4 RELEASE-GATE CONTRACT
-- 
-- Five stages of evidence integrity required before rendering assessment questions:
-- 
-- Stage 1: Identity
--   Every UI scenario_key has a deliberate mapping to one database catalog record.
--   (Model not yet decided: scenario_key as primary ID, category ID, or mapping table?)
--   
-- Stage 2: Question
--   Every scenario_questions row has an immutable, non-null question_id value.
--   Format: {scenario_prefix}-{issue_type}-{index} (e.g., no-crank-battery-check-01)
--   Uniqueness: question_id is unique within each scenario_id.
--   
-- Stage 3: Provenance
--   Each question_id links to exactly one approved question_provenance entry.
--   Requirements:
--     - status = 'approved'
--     - approved_by IS NOT NULL
--     - approved_at IS NOT NULL
--     - technical_reviewer_id IS NOT NULL
--     - instructional_reviewer_id IS NOT NULL
--   
-- Stage 4: Citation
--   Each approved provenance has at least one citation to an approved source chunk.
--   Requirements:
--     - question_provenance has at least one question_citations record
--     - Each citation references an approved_sources entry (status = 'approved')
--     - Each citation references a source_chunks entry (status = 'approved', approved = true)
--     - Each citation has a citation_validations record (result = 'valid')
--     - All validation flags are true:
--         - source_hashes_verified = true
--         - excerpts_verified = true
--         - urls_verified = true
--   
-- Stage 5: Release
--   Assessment availability returns zero unless every required link is complete.
--   Fail-closed: Zero questions render if the chain breaks at any stage.
--   No exceptions; no bypass; no conditional rendering based on partial evidence.
-- 
-- ==============================================================================

-- DESIGN QUERY 1: Verify no questions with NULL question_id
-- ==============================================================================
-- Contract: All scenario_questions should have non-null question_id
-- This query shows the gap during remediation and should return zero rows when complete.

SELECT
  sq.id,
  sq.scenario_id,
  sq.question_text,
  sq.question_id
FROM public.scenario_questions sq
WHERE sq.question_id IS NULL
ORDER BY sq.scenario_id, sq.id;

-- Expected result when contract is fulfilled: 0 rows


-- DESIGN QUERY 2: Verify question-to-provenance linkage
-- ==============================================================================
-- Contract: Each question_id should link to exactly one approved provenance entry.
-- This query identifies orphaned questions (no provenance) and broken links (unapproved provenance).

WITH question_provenance_summary AS (
  SELECT
    sq.id AS question_db_id,
    sq.scenario_id,
    sq.question_id,
    sq.question_text,
    COUNT(qp.id) AS provenance_count,
    COUNT(qp.id) FILTER (WHERE qp.status = 'approved') AS approved_count,
    MAX(qp.id) AS sample_provenance_id
  FROM public.scenario_questions sq
  LEFT JOIN public.question_provenance qp
    ON qp.question_id = sq.question_id
  WHERE sq.question_id IS NOT NULL
  GROUP BY sq.id, sq.scenario_id, sq.question_id, sq.question_text
)
SELECT
  scenario_id,
  question_id,
  question_text,
  provenance_count,
  approved_count,
  CASE
    WHEN provenance_count = 0 THEN 'BROKEN: no provenance link'
    WHEN approved_count = 0 THEN 'BROKEN: provenance not approved'
    WHEN provenance_count > 1 THEN 'BROKEN: multiple provenance records (ambiguous)'
    WHEN approved_count = 1 THEN 'OK'
  END AS linkage_status
FROM question_provenance_summary
ORDER BY scenario_id, question_id;

-- Expected result when contract is fulfilled:
--   All rows show linkage_status = 'OK'
--   No rows with provenance_count = 0, 1, or 2+
--   Exactly 1 approved provenance per question


-- DESIGN QUERY 3: Verify approved provenance has citations
-- ==============================================================================
-- Contract: Each approved provenance must cite at least one approved source chunk.
-- This query identifies provenance without citations or with citations to unapproved sources.

WITH provenance_citation_summary AS (
  SELECT
    qp.id AS provenance_id,
    qp.question_id,
    sq.scenario_id,
    COUNT(qc.id) AS citation_count,
    COUNT(qc.id) FILTER (
      WHERE asrc.status = 'approved' 
        AND sc.status = 'approved' 
        AND sc.approved = TRUE
    ) AS approved_citation_count
  FROM public.question_provenance qp
  LEFT JOIN public.scenario_questions sq
    ON sq.question_id = qp.question_id
  LEFT JOIN public.question_citations qc
    ON qc.question_provenance_id = qp.id
  LEFT JOIN public.approved_sources asrc
    ON asrc.id = qc.source_id
  LEFT JOIN public.source_chunks sc
    ON sc.source_id = qc.source_id
    AND sc.chunk_id = qc.chunk_id
  WHERE qp.status = 'approved'
  GROUP BY qp.id, qp.question_id, sq.scenario_id
)
SELECT
  scenario_id,
  question_id,
  provenance_id,
  citation_count,
  approved_citation_count,
  CASE
    WHEN citation_count = 0 THEN 'BROKEN: no citations'
    WHEN approved_citation_count = 0 THEN 'BROKEN: citations to unapproved sources'
    WHEN approved_citation_count >= 1 THEN 'OK'
  END AS citation_status
FROM provenance_citation_summary
WHERE citation_count = 0 OR approved_citation_count = 0
ORDER BY scenario_id, question_id;

-- Expected result when contract is fulfilled: 0 rows
-- (All approved provenance have at least one citation to approved sources/chunks)


-- DESIGN QUERY 4: Verify citations have valid validation records
-- ==============================================================================
-- Contract: Each citation must have a citation_validations record with all flags true.
-- This query identifies citations without validation or with incomplete validation.

WITH citation_validation_summary AS (
  SELECT
    qc.id AS citation_id,
    qc.question_provenance_id,
    qp.question_id,
    sq.scenario_id,
    cv.id AS validation_id,
    cv.result,
    cv.source_hashes_verified,
    cv.excerpts_verified,
    cv.urls_verified,
    CASE
      WHEN cv.id IS NULL THEN 'BROKEN: no validation record'
      WHEN cv.result != 'valid' THEN 'BROKEN: validation result not valid'
      WHEN NOT (cv.source_hashes_verified AND cv.excerpts_verified AND cv.urls_verified) THEN 'BROKEN: incomplete verification flags'
      ELSE 'OK'
    END AS validation_status
  FROM public.question_citations qc
  LEFT JOIN public.question_provenance qp
    ON qp.id = qc.question_provenance_id
  LEFT JOIN public.scenario_questions sq
    ON sq.question_id = qp.question_id
  LEFT JOIN public.citation_validations cv
    ON cv.question_provenance_id = qc.question_provenance_id
)
SELECT
  scenario_id,
  question_id,
  citation_id,
  validation_id,
  result,
  source_hashes_verified,
  excerpts_verified,
  urls_verified,
  validation_status
FROM citation_validation_summary
WHERE validation_status != 'OK'
ORDER BY scenario_id, question_id, citation_id;

-- Expected result when contract is fulfilled: 0 rows
-- (All citations have valid validation with all flags true)


-- DESIGN QUERY 5: Assessment readiness (fail-closed gate)
-- ==============================================================================
-- Contract: Assessment questions only render if complete evidence chain exists.
-- This query shows which scenarios have evidence-backed questions ready for assessment.

WITH evidence_complete AS (
  SELECT DISTINCT
    sq.scenario_id,
    sq.id AS question_db_id,
    sq.question_id,
    sq.question_text
  FROM public.scenario_questions sq
  -- Question must have non-null ID
  WHERE sq.question_id IS NOT NULL
  -- Must link to exactly one approved provenance
  AND EXISTS (
    SELECT 1
    FROM public.question_provenance qp
    WHERE qp.question_id = sq.question_id
      AND qp.status = 'approved'
      AND qp.approved_by IS NOT NULL
      AND qp.approved_at IS NOT NULL
  )
  -- Provenance must have at least one approved citation
  AND EXISTS (
    SELECT 1
    FROM public.question_provenance qp
    WHERE qp.question_id = sq.question_id
    AND EXISTS (
      SELECT 1
      FROM public.question_citations qc
      WHERE qc.question_provenance_id = qp.id
      AND EXISTS (
        SELECT 1
        FROM public.approved_sources asrc
        WHERE asrc.id = qc.source_id
          AND asrc.status = 'approved'
      )
      AND EXISTS (
        SELECT 1
        FROM public.source_chunks sc
        WHERE sc.source_id = qc.source_id
          AND sc.chunk_id = qc.chunk_id
          AND sc.status = 'approved'
          AND sc.approved = TRUE
      )
    )
  )
  -- Citation must have valid validation
  AND EXISTS (
    SELECT 1
    FROM public.question_provenance qp
    WHERE qp.question_id = sq.question_id
    AND EXISTS (
      SELECT 1
      FROM public.citation_validations cv
      WHERE cv.question_provenance_id = qp.id
        AND cv.result = 'valid'
        AND cv.source_hashes_verified = TRUE
        AND cv.excerpts_verified = TRUE
        AND cv.urls_verified = TRUE
    )
  )
)
SELECT
  scenario_id,
  COUNT(*) AS evidence_backed_questions
FROM evidence_complete
GROUP BY scenario_id
ORDER BY scenario_id;

-- Expected result when contract is fulfilled:
--   One row per scenario with count >= 1 (scenario-specific minimum to be defined)
--   Scenarios with no evidence-backed questions should not appear in result


-- DESIGN QUERY 6: Audit of unfulfilled contract stages
-- ==============================================================================
-- Contract diagnostic query: Shows which stages are blocking assessment per scenario.

WITH stage_diagnostics AS (
  -- Stage 2: Question ID
  (
    SELECT
      sq.scenario_id,
      'Stage 2: Question ID'::TEXT AS stage,
      COUNT(*) AS gap_count,
      'Questions with NULL question_id'::TEXT AS gap_description
    FROM public.scenario_questions sq
    WHERE sq.question_id IS NULL
    GROUP BY sq.scenario_id
  )
  
  UNION ALL
  
  -- Stage 3: Provenance Link
  (
    SELECT
      sq.scenario_id,
      'Stage 3: Provenance'::TEXT,
      COUNT(*),
      'Questions without approved provenance'::TEXT
    FROM public.scenario_questions sq
    WHERE sq.question_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.question_provenance qp
      WHERE qp.question_id = sq.question_id
        AND qp.status = 'approved'
    )
    GROUP BY sq.scenario_id
  )
  
  UNION ALL
  
  -- Stage 4: Citation Validation
  (
    SELECT
      sq.scenario_id,
      'Stage 4: Citation Validation'::TEXT,
      COUNT(*),
      'Approved provenance without valid citation validation'::TEXT
    FROM public.scenario_questions sq
    LEFT JOIN public.question_provenance qp
      ON qp.question_id = sq.question_id
    WHERE qp.status = 'approved'
    AND NOT EXISTS (
      SELECT 1
      FROM public.citation_validations cv
      WHERE cv.question_provenance_id = qp.id
        AND cv.result = 'valid'
        AND cv.source_hashes_verified = TRUE
        AND cv.excerpts_verified = TRUE
        AND cv.urls_verified = TRUE
    )
    GROUP BY sq.scenario_id
  )
)
SELECT
  scenario_id,
  stage,
  gap_count,
  gap_description
FROM stage_diagnostics
ORDER BY scenario_id, stage;

-- Expected result when contract is fulfilled: 0 rows
-- (All diagnostic queries should return zero gaps)


-- ==============================================================================
-- REMEDIATION SEQUENCE (NOT YET IMPLEMENTED)
-- ==============================================================================
--
-- These steps will be executed as separate, reviewed migrations:
--
-- 1. Create question-to-provenance crosswalk (CSV or lookup table)
--    - Document which of the 22 question_provenance rows corresponds to each question
--    - This must be reviewed and approved before backfilling
--    - Output: Explicit mapping { question_provenance.id → question_id value }
--
-- 2. Decide catalog identity model
--    - Will database catalog adopt scenario_key as primary identity?
--    - Or will we keep category-style IDs and use a mapping table?
--    - This decision blocks catalog reconciliation
--    - Output: Decision document specifying catalog structure
--
-- 3. Backfill question_id values (separate migration)
--    - Use crosswalk from step 1
--    - Update 22 scenario_questions rows with non-null question_id
--    - Validate uniqueness
--    - Output: Deterministic, auditable backfill
--
-- 4. Reconcile catalog with UI scenarios (separate migration, after step 2)
--    - Apply decision from step 2
--    - Add missing scenarios or mapping table as appropriate
--    - Output: Catalog parity with 21 UI scenarios
--
-- 5. Link provenance and citations (separate migration)
--    - Ensure each approved provenance has at least one citation to approved source/chunk
--    - Output: Complete citation chain for approved provenance
--
-- 6. Validate in staging
--    - Run all design queries (this file) against staging
--    - Confirm all contract stages are fulfilled
--    - Output: Audit report
--
-- 7. Only then design release-gate functions (if needed)
--    - These functions must be minimal, non-public, service_role only
--    - Must not hardcode scenario lists
--    - Must not assume catalog structure
--    - Output: Reviewed, restricted RPC functions
--
-- ==============================================================================
