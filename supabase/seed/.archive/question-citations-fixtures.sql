-- Staging Fixtures: Question Citations
-- Purpose: Link questions to source excerpts for citation validation
-- Creates 2 citations per question: one for answer support, one for explanation support
-- Total: 40 citations for 20 questions
-- CRITICAL: Each mapping must be explicitly reviewed evidence that the quote genuinely supports the role

-- Delete old fixtures
DELETE FROM public.question_citations WHERE id IN (
  SELECT qc.id FROM public.question_citations qc
  JOIN public.question_provenance qp ON qc.question_provenance_id = qp.id
  WHERE qp.question_id IN (
    SELECT id::text FROM public.scenario_questions
    WHERE scenario_id = 'no-crank'
  )
);

-- EXPLICIT CITATION MAPPING (Currently Empty - Awaiting Evidence Review)
-- Each row maps a question to a specific chunk with evidence of semantic support
-- To add mappings: populate citation_map CTE with reviewed (question_id, role, source_id, chunk_id) tuples
-- Do not use automatic ordering; each mapping must be manually validated
-- Current state: Empty relation (WHERE FALSE) ensures valid SQL while inserting zero citations
-- This is fail-closed: no unreviewed citations enter database
WITH citation_map(question_id, role, source_id, chunk_id) AS (
  -- Typed empty relation until evidence-reviewed mappings are available
  -- Example structure for future use (replace UUIDs with real reviewed mappings):
  -- VALUES
  --   ('QUESTION_ID_1', 'supports-answer',      'fixture-no-crank-source-1', 'fixture-no-crank-chunk-1'),
  --   ('QUESTION_ID_1', 'supports-explanation', 'fixture-no-crank-source-2', 'fixture-no-crank-chunk-2'),
  -- ...
  SELECT
    null::text as question_id,
    null::text as role,
    null::text as source_id,
    null::text as chunk_id
  WHERE FALSE
)
INSERT INTO public.question_citations (
  question_provenance_id,
  source_id,
  chunk_id,
  locator,
  quote,
  role
)
SELECT
  qp.id as question_provenance_id,
  cm.source_id,
  cm.chunk_id,
  sc.locator,
  sc.text_excerpt,
  cm.role
FROM citation_map cm
JOIN public.question_provenance qp ON qp.question_id = cm.question_id
JOIN public.source_chunks sc ON sc.chunk_id = cm.chunk_id AND sc.source_id = cm.source_id
WHERE qp.status = 'validated';

-- VERIFICATION QUERIES (run after populating citation_map)
-- These queries validate the fixture after evidence-reviewed mappings are added to the CTE

-- Query 1: Verify citation role distribution
-- SELECT role, count(*) FROM public.question_citations GROUP BY role ORDER BY role;
-- Expected: supports-answer: 20, supports-explanation: 20

-- Query 2: Detect questions missing either role
-- SELECT
--   qp.question_id,
--   count(*) FILTER (WHERE qc.role = 'supports-answer') as answer_citations,
--   count(*) FILTER (WHERE qc.role = 'supports-explanation') as explanation_citations
-- FROM public.question_provenance qp
-- LEFT JOIN public.question_citations qc ON qc.question_provenance_id = qp.id
-- GROUP BY qp.question_id
-- HAVING
--   count(*) FILTER (WHERE qc.role = 'supports-answer') = 0
--   OR
--   count(*) FILTER (WHERE qc.role = 'supports-explanation') = 0;
-- Expected: zero rows (every question must have both roles)

-- Query 3: Detect duplicate citations
-- SELECT question_provenance_id, source_id, chunk_id, role, count(*)
-- FROM public.question_citations
-- GROUP BY question_provenance_id, source_id, chunk_id, role
-- HAVING count(*) > 1;
-- Expected: zero rows (no duplicates)

-- Query 4: Verify empty state (before mappings are added)
-- SELECT count(*) as current_citation_count FROM public.question_citations;
-- Expected: 0 citations (fixture inserts zero rows with WHERE FALSE)

-- Summary of fixture load
SELECT COUNT(*) as fixture_citations_created FROM public.question_citations qc
JOIN public.question_provenance qp ON qc.question_provenance_id = qp.id
WHERE qp.question_id IN (
  SELECT id::text FROM public.scenario_questions
  WHERE scenario_id = 'no-crank'
);
