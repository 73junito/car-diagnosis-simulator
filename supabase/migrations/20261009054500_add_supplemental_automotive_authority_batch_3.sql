-- Supplemental automotive authority Batch 3.
-- Adds NHTSA vehicle-cybersecurity guidance as a citation/summary reference
-- for embedded, connected, network, cybersecurity, and software-defined vehicle coursework.
-- This does not grant evidence approval, assessment eligibility, or AI/RAG authority.

insert into public.curriculum_reference_sources (
  id, title, publisher, publication_year, subject_area, source_kind,
  canonical_url, local_filename, license_classification,
  citation_link_allowed, paraphrase_summary_allowed, direct_reproduction_allowed,
  database_storage_allowed, ai_rag_ingestion_allowed, commercial_use_allowed,
  attribution_required, share_alike_required, audience, status, rights_basis
) values
(
  'nhtsa-cybersecurity-best-practices-modern-vehicles-2022',
  'Cybersecurity Best Practices for the Safety of Modern Vehicles',
  'National Highway Traffic Safety Administration',
  2022,
  'vehicle cybersecurity, electronic architectures, in-vehicle networks, software updates, and cyber resilience',
  'technical-reference',
  'https://www.nhtsa.gov/sites/nhtsa.gov/files/2022-09/cybersecurity-best-practices-safety-modern-vehicles-2022-tag.pdf',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'NHTSA federal guidance used for automotive cybersecurity context. Citation/link and project-authored summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because the document may contain third-party material, standards references, or incorporated content that require separate review.'
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
  'nhtsa-cybersecurity-best-practices-modern-vehicles-2022',
  'ug-aut370-embedded-systems',
  'vehicle-electronic-security-architecture-reference',
  'NHTSA guidance supplements computing fundamentals with automotive-specific electronic architecture, software, interfaces, update mechanisms, segmentation, and cyber-resilience considerations.'
),
(
  'nhtsa-cybersecurity-best-practices-modern-vehicles-2022',
  'ug-aut380-cybersecurity',
  'vehicle-cybersecurity-best-practices-reference',
  'NHTSA guidance provides an automotive-domain risk-based cybersecurity context spanning design, development, monitoring, incident response, and protection of safety-critical vehicle systems.'
),
(
  'nhtsa-cybersecurity-best-practices-modern-vehicles-2022',
  'ug-aut390-connected-sdv',
  'connected-vehicle-software-cybersecurity-reference',
  'NHTSA guidance supplements general computing foundations with connected-vehicle interfaces, software update security, external communications, and lifecycle cybersecurity considerations relevant to software-defined vehicles.'
),
(
  'nhtsa-cybersecurity-best-practices-modern-vehicles-2022',
  'grad-aut550-automotive-networks',
  'in-vehicle-network-security-reference',
  'NHTSA guidance supplements network-computing foundations with automotive-specific protections for in-vehicle networks, external interfaces, segmentation, authentication, monitoring, and safety-critical communications.'
),
(
  'nhtsa-cybersecurity-best-practices-modern-vehicles-2022',
  'grad-aut555-embedded-ecu',
  'embedded-ecu-cybersecurity-reference',
  'NHTSA guidance provides automotive ECU and embedded-software cybersecurity context, including secure development, interfaces, software integrity, update mechanisms, and resilience.'
),
(
  'nhtsa-cybersecurity-best-practices-modern-vehicles-2022',
  'grad-aut570-cybersecurity',
  'vehicle-cybersecurity-best-practices-reference',
  'NHTSA guidance provides direct automotive-domain support for risk-based vehicle cybersecurity, threat mitigation, monitoring, information sharing, incident response, and safety-critical system protection.'
),
(
  'nhtsa-cybersecurity-best-practices-modern-vehicles-2022',
  'grad-aut575-software-defined-vehicle',
  'software-lifecycle-cybersecurity-reference',
  'NHTSA guidance supplements software-defined vehicle architecture with secure software development, update mechanisms, external interfaces, lifecycle processes, and cyber-resilience requirements.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
