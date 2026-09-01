-- REVIEWED OPT-IN HARDENING; not an automatically applied migration.
-- Preserve historical applied migrations. Generate a new migration with:
--   supabase migration new assessment_integrity_hardening
-- after reviewing this SQL against staging and production separately.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.scenario_questions
        WHERE correct_answer !~ '^[ABCD]$'
    ) THEN
        RAISE EXCEPTION 'Existing invalid answer keys must be corrected before hardening.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.scenario_questions
        GROUP BY scenario_id, question_text
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Duplicate scenario/question pairs exist; review and reconcile them before adding uniqueness.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'scenario_questions_correct_answer_check'
          AND conrelid = 'public.scenario_questions'::regclass
    ) THEN
        ALTER TABLE public.scenario_questions
            ADD CONSTRAINT scenario_questions_correct_answer_check
            CHECK (correct_answer ~ '^[ABCD]$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'scenario_questions_scenario_text_unique'
          AND conrelid = 'public.scenario_questions'::regclass
    ) THEN
        ALTER TABLE public.scenario_questions
            ADD CONSTRAINT scenario_questions_scenario_text_unique
            UNIQUE (scenario_id, question_text);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_question_provenance_approved_question
    ON public.question_provenance (question_id)
    WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_citation_validations_valid_provenance
    ON public.citation_validations (question_provenance_id)
    WHERE result = 'valid';

COMMIT;
