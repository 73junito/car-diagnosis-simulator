-- Resolve the SAGE automotive-engine diagnostic survey source-rights posture.
-- SAGE permissions guidance permits ordinary paraphrasing/summarizing with attribution
-- without separate permission, while substantial reuse, modification, database creation,
-- and AI/LLM uses remain restricted absent authorization. The article itself is restricted
-- access and no independent open license was found for the author-hosted copy.

update public.curriculum_reference_sources
set
  license_classification = 'SCHOLARLY_CITATION_PARAPHRASE_ALLOWED_REPRO_STORAGE_AI_COMMERCIAL_RESTRICTED',
  citation_link_allowed = true,
  paraphrase_summary_allowed = true,
  direct_reproduction_allowed = false,
  database_storage_allowed = false,
  ai_rag_ingestion_allowed = false,
  commercial_use_allowed = false,
  attribution_required = true,
  share_alike_required = false,
  rights_basis = 'SAGE identifies the article as restricted access. SAGE permissions guidance states that ordinary paraphrasing or summarizing does not require permission when it is not a close paraphrase and proper credit is given, while substantial reuse and modification require permission. SAGE Terms of Use also restrict database creation and prohibit use of SAGE services/materials for training large language models or generative AI absent authorization. An author-hosted PDF was located, but no independent open license or version-specific reuse grant was found. Therefore citation/linking and project-authored paraphrase/summary are allowed, while direct reproduction, database storage, AI/RAG ingestion, and commercial reuse remain disabled absent separate permission.',
  updated_at = now()
where id = 'automotive-engine-diagnostic-survey-2012';

update public.curriculum_reference_mappings
set notes = 'Peer-reviewed automotive-engine diagnostic survey supplements the data-science foundation with automotive fault-detection, fault-isolation, model-based, and data-driven diagnostic context. Citation/linking and project-authored paraphrase/summary are allowed under SAGE guidance; direct reproduction, database storage, AI/RAG ingestion, and commercial reuse remain restricted absent separate permission.'
where reference_id = 'automotive-engine-diagnostic-survey-2012'
  and lesson_plan_id = 'ug-engine-performance-foundations'
  and role = 'automotive-diagnostic-methods-reference';

update public.curriculum_reference_mappings
set notes = 'Peer-reviewed automotive diagnostic-method reference supporting systematic fault detection and isolation. Citation/linking and project-authored paraphrase/summary are allowed under SAGE guidance; no direct reproduction, database storage, AI/RAG ingestion, commercial reuse, or assessment-content authorization is granted.'
where reference_id = 'automotive-engine-diagnostic-survey-2012'
  and lesson_plan_id = 'ug-aut250-automotive-diagnostics-i'
  and role = 'automotive-diagnostic-methods-reference';
