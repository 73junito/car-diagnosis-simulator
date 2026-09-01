-- Schema-compatible, draft-only question ingestion.
-- Execute in the Supabase SQL Editor as an explicitly authorized operator.
-- Set the JSON payload in the same database session before running this file:
--
-- SELECT set_config(
--     'torquemind.question_batch',
--     '[{"scenario_id":"no-crank","question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A"}]',
--     false
-- );
--
-- Never enter credentials in this file. Questions must be personally reviewed.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('torquemind.reviewed-question-ingestion'));

CREATE TEMP TABLE torquemind_question_batch (
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
    ase_area text
) ON COMMIT DROP;

DO $$
DECLARE
    batch_json jsonb;
BEGIN
    batch_json := COALESCE(
        NULLIF(current_setting('torquemind.question_batch', true), '')::jsonb,
        '[]'::jsonb
    );

    IF jsonb_typeof(batch_json) <> 'array' THEN
        RAISE EXCEPTION 'torquemind.question_batch must contain a JSON array.';
    END IF;

    IF jsonb_array_length(batch_json) = 0 THEN
        RAISE EXCEPTION
            'No human-reviewed questions supplied. Set torquemind.question_batch explicitly; no sample questions will be manufactured.';
    END IF;

    INSERT INTO torquemind_question_batch (
        scenario_id, question_text, option_a, option_b, option_c, option_d,
        correct_answer, explanation, difficulty, topic, ase_area
    )
    SELECT
        btrim(item->>'scenario_id'),
        btrim(item->>'question_text'),
        btrim(item->>'option_a'),
        btrim(item->>'option_b'),
        btrim(item->>'option_c'),
        btrim(item->>'option_d'),
        upper(btrim(item->>'correct_answer')),
        NULLIF(btrim(item->>'explanation'), ''),
        NULLIF(btrim(item->>'difficulty'), ''),
        NULLIF(btrim(item->>'topic'), ''),
        NULLIF(btrim(item->>'ase_area'), '')
    FROM jsonb_array_elements(batch_json) AS item;

    IF EXISTS (
        SELECT 1
        FROM torquemind_question_batch
        WHERE scenario_id = '' OR question_text = ''
           OR option_a = '' OR option_b = '' OR option_c = '' OR option_d = ''
           OR correct_answer !~ '^[ABCD]$'
    ) THEN
        RAISE EXCEPTION
            'Every question requires a scenario, question, four nonblank options, and an A/B/C/D answer.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM torquemind_question_batch
        GROUP BY scenario_id, question_text
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'The supplied batch contains duplicate scenario/question pairs.';
    END IF;
END;
$$;

WITH inserted_questions AS (
    INSERT INTO public.scenario_questions (
        scenario_id, question_text, option_a, option_b, option_c, option_d,
        correct_answer, explanation, difficulty, topic, ase_area
    )
    SELECT
        batch.scenario_id, batch.question_text,
        batch.option_a, batch.option_b, batch.option_c, batch.option_d,
        batch.correct_answer, batch.explanation, batch.difficulty,
        batch.topic, batch.ase_area
    FROM torquemind_question_batch AS batch
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.scenario_questions AS existing
        WHERE existing.scenario_id = batch.scenario_id
          AND existing.question_text = batch.question_text
    )
    RETURNING id
)
INSERT INTO public.question_provenance (
    question_id, provenance_version, status, validation_checklist, notes
)
SELECT
    id::text,
    1,
    'draft',
    jsonb_build_object(
        'sources_linked', false,
        'citations_validated', false,
        'technical_review_complete', false,
        'instructional_review_complete', false
    ),
    'Imported as draft. Explicit evidence validation and independent human approval are required.'
FROM inserted_questions
ON CONFLICT (question_id, provenance_version) DO NOTHING;

-- Existing questions from an interrupted earlier import also need draft provenance.
INSERT INTO public.question_provenance (
    question_id, provenance_version, status, validation_checklist, notes
)
SELECT
    q.id::text, 1, 'draft',
    '{"sources_linked":false,"citations_validated":false,"technical_review_complete":false,"instructional_review_complete":false}'::jsonb,
    'Draft provenance restored by reviewed-question ingestion; approval is still required.'
FROM public.scenario_questions AS q
JOIN torquemind_question_batch AS batch
  ON batch.scenario_id = q.scenario_id
 AND batch.question_text = q.question_text
WHERE NOT EXISTS (
    SELECT 1 FROM public.question_provenance AS p WHERE p.question_id = q.id::text
)
ON CONFLICT (question_id, provenance_version) DO NOTHING;

COMMIT;

-- Safe summary: never return question text, answers, or explanations.
SELECT
    q.scenario_id,
    count(*) AS questions,
    count(*) FILTER (WHERE p.status = 'draft') AS draft_questions,
    count(*) FILTER (WHERE p.status = 'approved') AS previously_approved_questions
FROM public.scenario_questions AS q
LEFT JOIN public.question_provenance AS p ON p.question_id = q.id::text
GROUP BY q.scenario_id
ORDER BY q.scenario_id;
