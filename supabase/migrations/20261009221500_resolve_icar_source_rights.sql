-- Resolve the I-CAR ADAS source-rights posture.
-- I-CAR's current Terms and Conditions state that I-CAR site content may not be
-- reproduced, downloaded, disseminated, published, transferred, or used
-- commercially without I-CAR permission. This migration therefore resolves the
-- prior "reuse unverified" status to an explicitly restricted citation-only posture.

update public.curriculum_reference_sources
set
  license_classification = 'PROPRIETARY_CITATION_ONLY_REUSE_RESTRICTED_BY_TERMS',
  citation_link_allowed = true,
  paraphrase_summary_allowed = false,
  direct_reproduction_allowed = false,
  database_storage_allowed = false,
  ai_rag_ingestion_allowed = false,
  commercial_use_allowed = false,
  attribution_required = true,
  share_alike_required = false,
  rights_basis = 'I-CAR Terms and Conditions state that I-CAR site content may not be reproduced, downloaded, disseminated, published, transferred, displayed, or used commercially without I-CAR permission. The ADAS Collision Repair Diagnostics Process remains bibliographic citation/link support only. No paraphrase, reproduction, database storage, AI/RAG ingestion, or commercial reuse is authorized absent separate permission from I-CAR.',
  updated_at = now()
where id = 'icar-adas-diagnostic-process-2025';

update public.curriculum_reference_mappings
set notes = 'Industry ADAS diagnostic guidance supplements data-analysis foundations with automotive-specific pre-scan, communication readiness, OEM-information, and post-repair diagnostic context. Citation/link only under I-CAR terms; no source-text reuse, database storage, AI/RAG ingestion, or commercial reuse is authorized without separate permission.'
where reference_id = 'icar-adas-diagnostic-process-2025'
  and lesson_plan_id = 'ug-aut350-adas'
  and role = 'adas-diagnostic-process-reference';
