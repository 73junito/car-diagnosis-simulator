-- Read-only staging inventory; no tokens, answer keys, or question text returned.
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

SELECT expected.table_name, to_regclass('public.' || expected.table_name) IS NOT NULL AS exists_in_public
FROM (VALUES
    ('approved_sources'), ('source_chunks'), ('scenario_questions'),
    ('question_provenance'), ('question_citations'), ('citation_validations'),
    ('attempts'), ('attempt_answers'), ('ase_domains'), ('scenario_ase_map'),
    ('question_quality_scores'), ('external_data_resources')
) AS expected(table_name)
ORDER BY expected.table_name;

SELECT
    required.scenario_id,
    count(q.id) AS question_count,
    count(q.id) FILTER (WHERE p.status = 'approved') AS provenance_approved_count
FROM (VALUES ('no-crank'), ('charging-system')) AS required(scenario_id)
LEFT JOIN public.scenario_questions AS q ON q.scenario_id = required.scenario_id
LEFT JOIN public.question_provenance AS p ON p.question_id = q.id::text
GROUP BY required.scenario_id
ORDER BY required.scenario_id;
