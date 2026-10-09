-- Supplemental automotive authority Batch 6.
-- Closes the final single-source curriculum-reference gaps with federal measurement,
-- engine, safety, service-information, scholarly-literature, and emerging-technology context.
-- No mapping in this migration grants evidence approval or scored-assessment eligibility.

insert into public.curriculum_reference_sources (
  id, title, publisher, publication_year, subject_area, source_kind,
  canonical_url, local_filename, license_classification,
  citation_link_allowed, paraphrase_summary_allowed, direct_reproduction_allowed,
  database_storage_allowed, ai_rag_ingestion_allowed, commercial_use_allowed,
  attribution_required, share_alike_required, audience, status, rights_basis
) values
(
  'nist-si-2019',
  'The International System of Units (SI), 2019 Edition',
  'National Institute of Standards and Technology',
  2019,
  'SI units, quantities, dimensions, unit conversion, numerical values, measurement reporting, and engineering calculations',
  'technical-reference',
  'https://www.nist.gov/publications/international-system-units-si-2019-edition',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official NIST Special Publication 330 reference for SI quantities and units. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because the publication incorporates the international SI framework and may contain third-party or otherwise separately governed material.'
),
(
  'nist-tn1900-measurement-uncertainty',
  'Simple Guide for Evaluating and Expressing the Uncertainty of NIST Measurement Results',
  'National Institute of Standards and Technology',
  2015,
  'measurement uncertainty, measurement models, probability distributions, statistical methods, uncertainty evaluation, and reporting',
  'technical-reference',
  'https://www.nist.gov/publications/simple-guide-evaluating-and-expressing-uncertainty-nist-measurement-results',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official NIST Technical Note 1900 reference for measurement models and uncertainty analysis. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because examples, referenced methods, or incorporated material may require separate review.'
),
(
  'doe-internal-combustion-engine-basics',
  'Internal Combustion Engine Basics',
  'U.S. Department of Energy Transportation Technologies Office',
  null,
  'internal combustion engine architecture, four-stroke operation, spark ignition, compression ignition, combustion, power conversion, and efficiency',
  'technical-reference',
  'https://www.energy.gov/cmei/vehicles/articles/internal-combustion-engine-basics',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official U.S. Department of Energy technical reference describing internal-combustion engine operation and architecture. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because page media, linked resources, or incorporated third-party material may require separate review.'
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
  'nist-si-2019',
  'ug-aut110-automotive-math',
  'engineering-quantities-units-reference',
  'NIST SI guidance supplements algebra and trigonometry foundations with engineering quantities, unit symbols, derived units, decimal prefixes, and consistent reporting of numerical values used in automotive calculations.'
),
(
  'nist-tn1900-measurement-uncertainty',
  'ug-aut115-measurement-instrumentation',
  'measurement-uncertainty-reference',
  'NIST measurement guidance supplements physics foundations with measurands, measurement models, uncertainty sources, observation equations, statistical interpretation, and defensible reporting of measured results.'
),
(
  'doe-internal-combustion-engine-basics',
  'ug-aut130-engine-systems',
  'engine-operation-architecture-reference',
  'DOE engine guidance supplements physics foundations with automotive-specific cylinder, piston, crankshaft, four-stroke, spark-ignition, compression-ignition, combustion, and power-conversion relationships.'
),
(
  'gm-pre-post-scan-position-2022',
  'ug-aut180-service-information',
  'oem-service-information-verification-reference',
  'The GM position statement supplements technical-writing foundations with an OEM-authored example of authoritative service information, diagnostic direction, scan requirements, and post-repair verification.'
),
(
  'nist-tn1900-measurement-uncertainty',
  'ug-aut400-research-methods',
  'measurement-research-methods-reference',
  'NIST guidance supplements research communication with explicit measurement models, assumptions, uncertainty evaluation, statistical methods, and transparent reporting practices applicable to automotive research questions.'
),
(
  'osha-motor-vehicle-safety-aspects-2026',
  'ug-aut420-internship',
  'professional-safety-practice-reference',
  'OSHA vehicle-safety guidance supplements internship documentation with federal workplace-safety context and reinforces professional responsibility for safe work practices during supervised automotive experience.'
),
(
  'automotive-engine-diagnostic-survey-2012',
  'grad-applied-research-literature',
  'automotive-scholarly-literature-example',
  'The peer-reviewed automotive diagnostic survey provides a domain-specific scholarly-literature example for evaluating research scope, methods, synthesis, limitations, and relevance to applied automotive questions.'
),
(
  'nist-tn1900-measurement-uncertainty',
  'grad-aut520-data-analytics',
  'measurement-data-uncertainty-reference',
  'NIST guidance supplements data-science foundations with measurement models, probability distributions, uncertainty evaluation, statistical interpretation, and reporting of analytical results.'
),
(
  'doe-vto-electric-drive-systems-rd',
  'grad-aut590-technology-seminar',
  'emerging-vehicle-technology-reference',
  'DOE electric-drive research provides a current automotive-technology case for critical seminar review of performance, efficiency, reliability, component integration, research priorities, and technology-development tradeoffs.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
