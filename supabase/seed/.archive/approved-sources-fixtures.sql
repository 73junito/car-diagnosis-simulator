-- Staging Fixtures: Approved Sources
-- Purpose: Minimal citations library for testing
-- This fixture provides 3 approved sources for no-crank questions
-- Follows lifecycle: draft → validated → approved
--
-- CRITICAL: storage_path values must be HTTPS URLs allowlisted for validation
-- checksums must be real SHA256 hashes (64 hex chars) or will fail validator
-- Until validator runs with real evidence, citation_validations remains empty

-- Step 1: Delete old fixtures
DELETE FROM public.approved_sources WHERE id LIKE 'fixture-no-crank%';

-- Step 2: Insert as draft
INSERT INTO public.approved_sources (
  id,
  title,
  authors,
  publisher,
  publication_year,
  checksum,
  checksum_algorithm,
  language,
  storage_path,
  status
) VALUES
(
  'fixture-no-crank-source-1',
  'Automotive Electrical Systems: Battery and Starting',
  '["Smith, John", "Johnson, Alice"]'::jsonb,
  'TechPress',
  2023,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'sha256',
  'en',
  'https://cdn.autolearnpro.com/sources/fixtures/battery-systems-v1.pdf',
  'draft'
),
(
  'fixture-no-crank-source-2',
  'Engine Cranking Diagnosis and Troubleshooting',
  '["Brown, David"]'::jsonb,
  'AutomotiveEducation',
  2022,
  '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d',
  'sha256',
  'en',
  'https://cdn.autolearnpro.com/sources/fixtures/cranking-diagnosis-v1.pdf',
  'draft'
),
(
  'fixture-no-crank-source-3',
  'Starter Motor and Solenoid Failures',
  '["Garcia, Maria", "Lee, Robert"]'::jsonb,
  'ASEPress',
  2024,
  'd4735fea8e8416bd6edd1dfedfda6ca6c8cd98fe8d04d00b9a2b2c77f2c62627',
  'sha256',
  'en',
  'https://cdn.autolearnpro.com/sources/fixtures/starter-solenoid-v1.pdf',
  'draft'
);

-- Step 3: Transition to validated
UPDATE public.approved_sources
SET status = 'validated'
WHERE id LIKE 'fixture-no-crank%' AND status = 'draft';

-- Step 4: Transition to approved
UPDATE public.approved_sources
SET status = 'approved'
WHERE id LIKE 'fixture-no-crank%' AND status = 'validated';

-- Verify
SELECT COUNT(*) as fixture_sources_approved FROM public.approved_sources
WHERE id LIKE 'fixture-no-crank%' AND status = 'approved';

-- Verify inserts
SELECT COUNT(*) as fixture_sources_created FROM public.approved_sources WHERE id LIKE 'fixture-no-crank%';
