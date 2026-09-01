-- Read-only evidence integrity. The stored excerpt is never included in output.
SELECT
    source.id AS source_id,
    source.status,
    source.checksum ~ '^[0-9a-f]{64}$' AS checksum_format_valid,
    source.license_reviewed_by IS NOT NULL AS has_license_reviewer,
    source.license_reviewed_at IS NOT NULL AS has_license_review_timestamp
FROM public.approved_sources AS source
ORDER BY source.id;

SELECT
    chunk.chunk_id,
    chunk.source_id,
    chunk.status,
    chunk.approved,
    chunk.text_hash ~ '^[0-9a-f]{64}$' AS hash_format_valid,
    encode(pg_catalog.sha256(convert_to(chunk.text_excerpt, 'UTF8')), 'hex')
        = lower(chunk.text_hash) AS excerpt_hash_matches,
    chunk.approved_by IS NOT NULL AS has_human_reviewer,
    chunk.approved_at IS NOT NULL AS has_review_timestamp
FROM public.source_chunks AS chunk
ORDER BY chunk.source_id, chunk.chunk_id;

SELECT
    q.scenario_id,
    p.id AS provenance_id,
    p.status AS provenance_status,
    count(DISTINCT citation.id) AS citation_count,
    count(DISTINCT validation.id) FILTER (
        WHERE validation.result = 'valid'
          AND validation.source_hashes_verified
          AND validation.excerpts_verified
          AND validation.urls_verified
    ) AS fully_validated_records,
    p.technical_reviewer_id IS NOT NULL AS technically_reviewed,
    p.instructional_reviewer_id IS NOT NULL AS instructionally_reviewed,
    p.approved_by IS NOT NULL AS explicitly_approved
FROM public.scenario_questions AS q
JOIN public.question_provenance AS p ON p.question_id = q.id::text
LEFT JOIN public.question_citations AS citation ON citation.question_provenance_id = p.id
LEFT JOIN public.citation_validations AS validation ON validation.question_provenance_id = p.id
GROUP BY q.scenario_id, p.id, p.status
ORDER BY q.scenario_id, p.id;
