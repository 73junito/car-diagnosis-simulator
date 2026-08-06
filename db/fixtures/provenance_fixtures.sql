-- Fixtures for provenance tests
-- Approved source
INSERT INTO public.approved_sources (id, title, publisher, storage_path, checksum, checksum_algorithm, status, version, uploaded_by)
VALUES (
  'fixture-approved-source',
  'ASE A6 2024 (fixture)',
  'ASE Foundation',
  '/fixtures/ase-a6-2024.pdf',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'sha256',
  'draft',
  1,
  null
);

-- Approved chunk
INSERT INTO public.source_chunks (chunk_id, source_id, source_version, title, section, page_start, page_end, locator, text_excerpt, token_count, text_hash, status, approved)
VALUES (
  'fixture-approved-chunk',
  'fixture-approved-source',
  1,
  'Starting System Diagnosis',
  'Starter Circuit Testing',
  118,
  123,
  'A6 > Starting System > Starter Circuit Testing',
  'Fixture excerpt: check battery voltage at rest and under crank.',
  50,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'draft',
  true
);

-- Approved question provenance and citations
INSERT INTO public.question_provenance (id, question_id, provenance_version, status, validation_checklist, approved_by, approved_at)
VALUES (
  gen_random_uuid(),
  'fixture-approved-question',
  1,
  'draft',
  jsonb_build_object('answer_verified', true, 'explanation_verified', true, 'citation_matches_excerpt', true, 'license_ok', true),
  null,
  now()
);

-- Link citation to question_provenance (we need to find the provenance id inserted above)
WITH qp AS (
  SELECT id FROM public.question_provenance WHERE question_id = 'fixture-approved-question' ORDER BY approved_at DESC LIMIT 1
)
INSERT INTO public.question_citations (question_provenance_id, source_id, chunk_id, locator, quote, role)
SELECT qp.id, 'fixture-approved-source', 'fixture-approved-chunk', 'Starter Circuit Testing', 'Fixture excerpt: check battery voltage at rest and under crank.', 'supports-answer'
FROM qp;

-- Also an explanation citation
WITH qp AS (
  SELECT id FROM public.question_provenance WHERE question_id = 'fixture-approved-question' ORDER BY approved_at DESC LIMIT 1
)
INSERT INTO public.question_citations (question_provenance_id, source_id, chunk_id, locator, quote, role)
SELECT qp.id, 'fixture-approved-source', 'fixture-approved-chunk', 'Starter Circuit Testing', 'Fixture excerpt: check battery voltage at rest and under crank.', 'supports-explanation'
FROM qp;

-- Invalid fixture: question without citations
INSERT INTO public.question_provenance (id, question_id, provenance_version, status, validation_checklist)
VALUES (gen_random_uuid(), 'fixture-invalid-missing-citations', 1, 'validated', jsonb_build_object('answer_verified', true, 'explanation_verified', true, 'citation_matches_excerpt', false, 'license_ok', true));
