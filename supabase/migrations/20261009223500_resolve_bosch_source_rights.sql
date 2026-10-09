-- Resolve the Bosch alternator poster source-rights posture.
-- Bosch Mobility Aftermarket's legal notice states that website content is
-- copyright-protected, no IP license is granted by the site, and commercial
-- copying/distribution/modification requires rights-holder consent.

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
  rights_basis = 'Bosch Mobility Aftermarket legal notices state that Bosch website content is protected by copyright and other laws, that the website grants no license to use Bosch or third-party intellectual property, and that commercial copying, dissemination, modification, or making content available to third parties requires consent of the respective rights owner. The alternator poster therefore remains bibliographic citation/link support only; no paraphrase, reproduction, database storage, AI/RAG ingestion, or commercial reuse is authorized absent separate permission.',
  updated_at = now()
where id = 'bosch-alternator-technical-poster-2020';

update public.curriculum_reference_mappings
set notes = 'Supplier-authored automotive alternator reference supporting rotor/stator, excitation, rectification, and charging-system component relationships. Citation/link only under Bosch legal terms; no source-text reuse, database storage, AI/RAG ingestion, or commercial reuse is authorized without separate permission.'
where reference_id = 'bosch-alternator-technical-poster-2020'
  and lesson_plan_id = 'ug-electrical-charging-system'
  and role = 'charging-system-component-reference';

update public.curriculum_reference_mappings
set notes = 'Automotive-specific alternator architecture supplements general circuit theory for advanced electrical-system analysis. Citation/link only under Bosch legal terms and not a substitute for applicable OEM service information.'
where reference_id = 'bosch-alternator-technical-poster-2020'
  and lesson_plan_id = 'ug-aut240-electrical-systems-ii'
  and role = 'charging-system-architecture-reference';
