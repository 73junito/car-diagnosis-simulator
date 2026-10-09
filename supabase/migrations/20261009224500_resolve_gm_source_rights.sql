-- Resolve the GM pre/post-scan position statement source-rights posture.
-- GM's copyright notice and Terms of Service reserve website content rights and
-- prohibit reproduction, distribution, modification, reposting, and other uses
-- beyond those expressly permitted without GM's written permission.

update public.curriculum_reference_sources
set
  license_classification = 'OEM_CITATION_ONLY_REUSE_RESTRICTED_BY_TERMS',
  citation_link_allowed = true,
  paraphrase_summary_allowed = false,
  direct_reproduction_allowed = false,
  database_storage_allowed = false,
  ai_rag_ingestion_allowed = false,
  commercial_use_allowed = false,
  attribution_required = true,
  share_alike_required = false,
  rights_basis = 'General Motors copyright and website terms state that GM website materials are protected by copyright and other intellectual-property rights and may not be reproduced, distributed, modified, reposted, copied, or otherwise used beyond the permissions expressly granted without GM written permission. The Pre- and Post-Scan of Collision Vehicles position statement therefore remains bibliographic citation/link support only. No paraphrase, reproduction, database storage, AI/RAG ingestion, or commercial reuse is authorized absent separate written permission from GM.',
  updated_at = now()
where id = 'gm-pre-post-scan-position-2022';

update public.curriculum_reference_mappings
set notes = 'OEM diagnostic position statement supplements data-science reasoning with automotive-specific pre/post scan and post-repair verification context. Citation/link only under GM copyright and website terms; no source-text reuse, database storage, AI/RAG ingestion, or commercial reuse is authorized without separate written permission.'
where reference_id = 'gm-pre-post-scan-position-2022'
  and lesson_plan_id = 'ug-aut300-advanced-diagnostics'
  and role = 'post-repair-verification-reference';
