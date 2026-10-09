-- Supplemental automotive authority Batch 5.
-- Adds federal sources for systems modeling, automated-driving safety, and digital twins,
-- and reuses existing automotive references where they directly strengthen engine,
-- diagnostics, vehicle-dynamics, and capstone lessons.
-- No mapping in this migration grants evidence approval or scored-assessment eligibility.

insert into public.curriculum_reference_sources (
  id, title, publisher, publication_year, subject_area, source_kind,
  canonical_url, local_filename, license_classification,
  citation_link_allowed, paraphrase_summary_allowed, direct_reproduction_allowed,
  database_storage_allowed, ai_rag_ingestion_allowed, commercial_use_allowed,
  attribution_required, share_alike_required, audience, status, rights_basis
) values
(
  'nasa-systems-modeling-handbook-2025',
  'NASA Systems Modeling Handbook for Systems Engineering',
  'National Aeronautics and Space Administration',
  2025,
  'systems modeling, SysML, requirements, verification, validation, model planning, and systems engineering integration',
  'technical-reference',
  'https://standards.nasa.gov/standard/NASA/NASA-HDBK-1009',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official NASA technical-standard reference. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because the handbook may include standards-derived, trademarked, or otherwise incorporated third-party material requiring separate review.'
),
(
  'nhtsa-automated-driving-systems-guidance',
  'Automated Driving Systems',
  'National Highway Traffic Safety Administration',
  null,
  'automated driving systems, system safety, operational design domain, object and event detection and response, fallback, testing, and deployment',
  'technical-reference',
  'https://www.nhtsa.gov/vehicle-manufacturers/automated-driving-systems',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official NHTSA automated-driving safety guidance. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because linked guidance, images, standards references, or incorporated third-party material may require separate review.'
),
(
  'nist-digital-twins-advanced-manufacturing',
  'Digital Twins for Advanced Manufacturing',
  'National Institute of Standards and Technology',
  null,
  'digital twins, synchronized models, verification, validation, uncertainty quantification, predictive analysis, and lifecycle integration',
  'technical-reference',
  'https://www.nist.gov/programs-projects/digital-twins-advanced-manufacturing',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official NIST digital-twin research reference. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because linked publications, images, standards content, or incorporated third-party material may require separate review.'
)
on conflict (id) do update set
  title = excluded.title,
  publisher = excluded.publisher,
  publication_year = excluded.publication_year,
  subject_area = excluded.subject_area,
  source_kind = excluded.source_kind,
  canonical_url = excluded.canonical_url,
  local_filename = excluded.local_filename,
  license_classification = excluded.license_classification,
  citation_link_allowed = excluded.citation_link_allowed,
  paraphrase_summary_allowed = excluded.paraphrase_summary_allowed,
  direct_reproduction_allowed = excluded.direct_reproduction_allowed,
  database_storage_allowed = excluded.database_storage_allowed,
  ai_rag_ingestion_allowed = excluded.ai_rag_ingestion_allowed,
  commercial_use_allowed = excluded.commercial_use_allowed,
  attribution_required = excluded.attribution_required,
  share_alike_required = excluded.share_alike_required,
  audience = excluded.audience,
  status = excluded.status,
  rights_basis = excluded.rights_basis,
  updated_at = now();

insert into public.curriculum_reference_mappings (
  reference_id, lesson_plan_id, role, notes
) values
(
  'automotive-engine-diagnostic-survey-2012',
  'ug-aut200-engine-systems-ii',
  'engine-diagnostic-methods-reference',
  'The automotive-engine diagnostic survey supplements engineering-mechanics foundations with domain-specific fault-detection and diagnostic-method context for advanced engine mechanical analysis.'
),
(
  'automotive-engine-diagnostic-survey-2012',
  'ug-aut201-engine-systems-ii-lab',
  'engine-diagnostic-methods-reference',
  'The automotive-engine diagnostic survey supplements laboratory measurement foundations with automotive fault-detection, signal-based diagnosis, and evidence interpretation context.'
),
(
  'nhtsa-fmvss-126-electronic-stability-control',
  'ug-aut260-vehicle-dynamics',
  'vehicle-stability-dynamics-reference',
  'FMVSS No. 126 supplements physics foundations with automotive stability-control concepts involving yaw response, lateral stability, steering inputs, and vehicle dynamic behavior.'
),
(
  'nasa-systems-modeling-handbook-2025',
  'ug-aut450-capstone-i',
  'systems-modeling-project-planning-reference',
  'NASA systems-modeling guidance supplements capstone planning with stakeholder expectations, requirements, model planning, measures of performance, and verification/validation planning.'
),
(
  'nasa-systems-modeling-handbook-2025',
  'ug-aut451-capstone-ii',
  'systems-modeling-verification-validation-reference',
  'NASA systems-modeling guidance supplements capstone completion with traceable requirements, model-based analysis, verification, validation, results, and reporting.'
),
(
  'nasa-systems-modeling-handbook-2025',
  'grad-aut501-integrated-systems',
  'model-based-systems-integration-reference',
  'NASA systems-modeling guidance supplements the existing systems-engineering foundation with explicit model organization, relationships, requirements, verification, validation, and integrated systems-engineering work products.'
),
(
  'nasa-systems-modeling-handbook-2025',
  'grad-aut515-systems-modeling',
  'systems-modeling-verification-validation-reference',
  'NASA guidance directly supports model planning, model construction, requirements representation, measures of performance, and model-supported verification and validation.'
),
(
  'nist-digital-twins-advanced-manufacturing',
  'grad-aut515-systems-modeling',
  'digital-model-validation-reference',
  'NIST digital-twin guidance supplements systems modeling with synchronized models, data integration, model validation, uncertainty considerations, and lifecycle-oriented implementation.'
),
(
  'nhtsa-automated-driving-systems-guidance',
  'grad-aut560-adas-perception',
  'adas-oedr-safety-reference',
  'NHTSA automated-driving guidance supplements data-analysis foundations with object and event detection and response, operational design domain, system safety, fallback, and real-world validation context.'
),
(
  'nhtsa-automated-driving-systems-guidance',
  'grad-aut565-autonomous-systems',
  'automated-driving-system-safety-reference',
  'NHTSA guidance directly supports automated-system architecture and validation through system safety, operational design domain, object/event response, fallback, and deployment considerations.'
),
(
  'nist-digital-twins-advanced-manufacturing',
  'grad-aut585-digital-twins',
  'digital-twin-validation-lifecycle-reference',
  'NIST guidance directly supports digital-twin concepts including synchronized virtual representations, validation, uncertainty quantification, predictive analysis, and lifecycle integration.'
),
(
  'automotive-engine-diagnostic-survey-2012',
  'grad-diagnostic-evidence-analysis',
  'automotive-diagnostic-methods-reference',
  'The automotive-engine diagnostic survey supplements data-science foundations with domain-specific automotive fault-detection methods and diagnostic-evidence interpretation.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
