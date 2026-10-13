-- Resolve reuse posture for the 2023 World Electric Vehicle Journal battery SOC/SOH review.
-- The MDPI article page explicitly states that the article is Open Access under CC BY 4.0.
-- Separately credited third-party material remains independently governed.

update public.curriculum_reference_sources
set
  license_classification = 'CC_BY_4_0',
  citation_link_allowed = true,
  paraphrase_summary_allowed = true,
  direct_reproduction_allowed = true,
  database_storage_allowed = true,
  ai_rag_ingestion_allowed = true,
  commercial_use_allowed = true,
  attribution_required = true,
  share_alike_required = false,
  rights_basis = 'MDPI identifies this World Electric Vehicle Journal article as Open Access and distributed under the Creative Commons Attribution 4.0 International license (CC BY 4.0). Reuse, adaptation, storage, AI/RAG ingestion, and commercial use are allowed with attribution for article content covered by that license. Separately credited third-party figures, excerpts, datasets, or other material are not assumed to be covered unless their credit line or license permits reuse.',
  updated_at = now()
where id = 'scholar-battery-soc-soh-review-2023';

update public.curriculum_reference_mappings
set notes = 'Peer-reviewed EV battery review supplements chemistry fundamentals with SOC/SOH estimation methods and the use of voltage, current, and temperature evidence. Article content is CC BY 4.0 with attribution; separately credited third-party material remains independently governed.'
where reference_id = 'scholar-battery-soc-soh-review-2023'
  and lesson_plan_id = 'ug-aut340-battery-management'
  and role = 'battery-state-estimation-reference';
