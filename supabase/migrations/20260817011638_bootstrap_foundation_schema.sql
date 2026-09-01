-- Staging Bootstrap Schema
-- Purpose: Initialize jchfruprqpeypdttvlam (staging database) with foundation schema only
-- This is NOT a production migration. Do not use in production.
-- Apply this in Supabase SQL Editor for staging database.
-- Then apply TTED805 migrations separately in order.

-- ============================================================================
-- 1. SCENARIO_QUESTIONS (Foundation Table)
-- ============================================================================
-- Production-compatible schema (no question_id, no status, no constraints beyond production)

CREATE TABLE IF NOT EXISTS public.scenario_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id text NOT NULL,
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  difficulty text,
  topic text,
  ase_area text,
  created_at timestamptz DEFAULT now()
);

-- RLS: Service-role only access
ALTER TABLE public.scenario_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scenario_questions FROM anon, authenticated;
GRANT SELECT ON public.scenario_questions TO service_role;

CREATE INDEX IF NOT EXISTS idx_scenario_questions_scenario_id ON public.scenario_questions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_questions_difficulty ON public.scenario_questions(difficulty);

COMMENT ON TABLE public.scenario_questions IS 'Assessment questions. Service-role only access.';
COMMENT ON COLUMN public.scenario_questions.correct_answer IS 'Answer key (A-D). Never exposed to browsers.';

-- ============================================================================
-- 2. APPROVED_SOURCES (Citation Library)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approved_sources (
    id text PRIMARY KEY,
    title text NOT NULL,
    authors jsonb DEFAULT '[]'::jsonb,
    publisher text,
    publication_year integer,
    license jsonb DEFAULT '{}'::jsonb,
    original_filename text,
    storage_path text NOT NULL,
    checksum text NOT NULL,
    checksum_algorithm text DEFAULT 'sha256',
    language text DEFAULT 'en',
    version integer DEFAULT 1,
    status text CHECK (status IN ('draft', 'source-linked', 'validated', 'approved', 'retired', 'superseded')),
    superseded_by text REFERENCES public.approved_sources(id),
    uploaded_by uuid,
    uploaded_at timestamptz DEFAULT now(),
    license_reviewed_by uuid,
    license_reviewed_at timestamptz,
    notes text,
    UNIQUE (checksum)
);

ALTER TABLE public.approved_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.approved_sources FROM anon, authenticated;
GRANT SELECT ON public.approved_sources TO service_role;

CREATE INDEX IF NOT EXISTS idx_approved_sources_status ON public.approved_sources(status);
CREATE INDEX IF NOT EXISTS idx_approved_sources_checksum ON public.approved_sources(checksum);

-- ============================================================================
-- 3. SOURCE_CHUNKS (Citation Excerpts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.source_chunks (
    chunk_id text PRIMARY KEY,
    source_id text NOT NULL REFERENCES public.approved_sources(id) ON DELETE RESTRICT,
    source_version integer NOT NULL,
    title text,
    section text,
    page_start integer,
    page_end integer,
    locator text,
    text_excerpt text NOT NULL,
    token_count integer NOT NULL,
    overlap_before_tokens integer DEFAULT 0,
    overlap_after_tokens integer DEFAULT 0,
    text_hash text NOT NULL,
    language text DEFAULT 'en',
    status text CHECK (status IN ('draft', 'source-linked', 'validated', 'approved', 'retired', 'superseded')),
    approved boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    approved_by uuid,
    approved_at timestamptz,
    CHECK (page_start IS NOT NULL OR section IS NOT NULL OR locator IS NOT NULL),
    UNIQUE (source_id, text_hash)
);

ALTER TABLE public.source_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.source_chunks FROM anon, authenticated;
GRANT SELECT ON public.source_chunks TO service_role;

CREATE INDEX IF NOT EXISTS idx_source_chunks_source_id ON public.source_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_status ON public.source_chunks(status);
CREATE INDEX IF NOT EXISTS idx_source_chunks_text_hash ON public.source_chunks(text_hash);

-- ============================================================================
-- 4. QUESTION_PROVENANCE (Question Evidence Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.question_provenance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id text NOT NULL,
    provenance_version integer DEFAULT 1,
    status text CHECK (status IN ('draft', 'source-linked', 'validated', 'approved', 'retired', 'superseded')),
    validation_checklist jsonb DEFAULT '{}'::jsonb,
    technical_reviewer_id uuid,
    technical_reviewed_at timestamptz,
    instructional_reviewer_id uuid,
    instructional_reviewed_at timestamptz,
    approved_by uuid,
    approved_at timestamptz,
    notes text,
    UNIQUE (question_id, provenance_version)
);

ALTER TABLE public.question_provenance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_provenance FROM anon, authenticated;
GRANT SELECT ON public.question_provenance TO service_role;

CREATE INDEX IF NOT EXISTS idx_question_provenance_question_id ON public.question_provenance(question_id);
CREATE INDEX IF NOT EXISTS idx_question_provenance_status ON public.question_provenance(status);

-- ============================================================================
-- 5. QUESTION_CITATIONS (Question → Source Links)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.question_citations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_provenance_id uuid NOT NULL REFERENCES public.question_provenance(id) ON DELETE CASCADE,
    source_id text NOT NULL REFERENCES public.approved_sources(id) ON DELETE RESTRICT,
    chunk_id text NOT NULL REFERENCES public.source_chunks(chunk_id) ON DELETE RESTRICT,
    locator text,
    quote text,
    role text NOT NULL CHECK (
        role IN (
            'supports-question',
            'supports-answer',
            'supports-explanation',
            'supports-next-step',
            'supports-ase-concept'
        )
    )
);

ALTER TABLE public.question_citations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_citations FROM anon, authenticated;
GRANT SELECT ON public.question_citations TO service_role;

CREATE INDEX IF NOT EXISTS idx_question_citations_question_provenance_id ON public.question_citations(question_provenance_id);
CREATE INDEX IF NOT EXISTS idx_question_citations_source_id ON public.question_citations(source_id);
CREATE INDEX IF NOT EXISTS idx_question_citations_chunk_id ON public.question_citations(chunk_id);

-- ============================================================================
-- STAGING BOOTSTRAP COMPLETE
-- ============================================================================
-- Next steps (user responsibility):
--
-- 1. Run TTED805 migrations in order:
--    - 20260812-create-attempts.sql
--    - 20260813-create-citation-validations.sql
--    - 20260814-create-attempt-answers.sql
--
-- 2. Load synthetic fixtures:
--    - Execute supabase/seed/scenario_questions.sql
--
-- 3. DO NOT apply lockdown (20260815) until E2E verified
--
-- This bootstrap matches production schema exactly.
-- No extra constraints, no manufactured data.
