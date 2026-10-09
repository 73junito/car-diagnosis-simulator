-- Resolve the reuse posture for the IES/REL continuous-improvement toolkit.
-- REL 2021-014 expressly states that the report is in the public domain and
-- may be reprinted without permission. Source-level controls remain conservative
-- for reproduction, database storage, and AI/RAG because third-party material
-- cited or embedded in the report is not assumed to share that status.

update public.curriculum_reference_sources
set
  license_classification = 'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  citation_link_allowed = true,
  paraphrase_summary_allowed = true,
  direct_reproduction_allowed = false,
  database_storage_allowed = false,
  ai_rag_ingestion_allowed = false,
  commercial_use_allowed = true,
  attribution_required = true,
  share_alike_required = false,
  rights_basis = 'Official IES/REL publication REL 2021-014 states that the report is in the public domain and may be reprinted without permission. Project-authored paraphrase and commercial use of the federal report text are therefore allowed. Source-level direct reproduction, database storage, and AI/RAG ingestion remain disabled because third-party works, excerpts, figures, instruments, or linked materials cited or embedded in the report retain independent rights and are not assumed public domain. Attribution remains required by project policy.',
  updated_at = now()
where id = 'ies-continuous-improvement-education-toolkit-2020';

update public.curriculum_reference_mappings
set notes = 'Authoritative education-improvement reference supporting needs diagnosis, stakeholder participation, Plan-Do-Study-Act cycles, data collection, implementation, reflection, and evaluation. Federal report text is public domain; third-party material remains outside that grant and source-level reproduction/database/AI-RAG controls stay disabled.'
where reference_id = 'ies-continuous-improvement-education-toolkit-2020'
  and lesson_plan_id = 'grad-technical-instructional-leadership'
  and role = 'continuous-improvement-leadership';
