-- Fail-closed evidence-backed readiness. Never includes answer-key fields.
WITH ready_questions AS (
    SELECT DISTINCT q.id, q.scenario_id
    FROM public.scenario_questions AS q
    JOIN public.question_provenance AS p
      ON p.question_id = q.id::text
     AND p.status = 'approved'
     AND p.approved_by IS NOT NULL
     AND p.approved_at IS NOT NULL
     AND p.technical_reviewer_id IS NOT NULL
     AND p.technical_reviewed_at IS NOT NULL
     AND p.instructional_reviewer_id IS NOT NULL
     AND p.instructional_reviewed_at IS NOT NULL
    JOIN public.question_citations AS citation
      ON citation.question_provenance_id = p.id
    JOIN public.approved_sources AS source
      ON source.id = citation.source_id
     AND source.status = 'approved'
     AND source.license_reviewed_by IS NOT NULL
     AND source.license_reviewed_at IS NOT NULL
    JOIN public.source_chunks AS chunk
      ON chunk.chunk_id = citation.chunk_id
     AND chunk.source_id = citation.source_id
     AND chunk.status = 'approved'
     AND chunk.approved IS TRUE
     AND chunk.approved_by IS NOT NULL
     AND chunk.approved_at IS NOT NULL
     AND chunk.text_hash ~ '^[0-9a-f]{64}$'
     AND encode(pg_catalog.sha256(convert_to(chunk.text_excerpt, 'UTF8')), 'hex')
         = lower(chunk.text_hash)
    JOIN public.citation_validations AS validation
      ON validation.question_provenance_id = p.id
     AND validation.result = 'valid'
     AND validation.source_hashes_verified
     AND validation.excerpts_verified
     AND validation.urls_verified
)
SELECT
    required.scenario_id,
    required.minimum_required,
    count(ready.id) AS evidence_backed_questions,
    count(ready.id) >= required.minimum_required AS gate_ready
FROM (VALUES ('no-crank', 2), ('charging-system', 1))
    AS required(scenario_id, minimum_required)
LEFT JOIN ready_questions AS ready ON ready.scenario_id = required.scenario_id
GROUP BY required.scenario_id, required.minimum_required
ORDER BY required.scenario_id;
