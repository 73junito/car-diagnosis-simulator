-- Reference coverage Batch 5: complete undergraduate reference coverage with authoritative
-- safety, environmental, and professional-practice references.
-- These records are supplemental references only. They do not grant evidence approval,
-- AI/RAG ingestion rights, direct-reproduction rights, or assessment eligibility.

insert into public.curriculum_reference_sources (
  id, title, publisher, publication_year, subject_area, source_kind,
  canonical_url, local_filename, license_classification,
  citation_link_allowed, paraphrase_summary_allowed, direct_reproduction_allowed,
  database_storage_allowed, ai_rag_ingestion_allowed, commercial_use_allowed,
  attribution_required, share_alike_required, audience, status, rights_basis
) values
(
  'osha-motor-vehicle-safety-aspects-2026',
  'Motor Vehicle Safety - Vehicle Safety Aspects',
  'Occupational Safety and Health Administration',
  null,
  'occupational and vehicle safety',
  'technical-reference',
  'https://www.osha.gov/motor-vehicle-safety/vehicle-safety-aspects',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'OSHA is a U.S. Department of Labor agency. Federal-agency text is generally not protected by U.S. copyright under 17 U.S.C. 105. Source-level reproduction, database-storage, and AI/RAG permissions remain disabled here because third-party elements are not assumed public domain.'
),
(
  'epa-automotive-sectors-regulatory-information-2026',
  'Automotive Sectors (NAICS 336, 4231, 8111)',
  'U.S. Environmental Protection Agency',
  2026,
  'automotive environmental compliance',
  'technical-reference',
  'https://www.epa.gov/regulatory-information-sector/automotive-sectors-naics-336-4231-8111',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'EPA is a U.S. federal agency. Federal-agency text is generally not protected by U.S. copyright under 17 U.S.C. 105. Source-level reproduction, database-storage, and AI/RAG permissions remain disabled here because linked or third-party elements are not assumed public domain.'
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
  'osha-motor-vehicle-safety-aspects-2026',
  'ug-aut101-foundations',
  'safety-professional-foundation',
  'Government safety reference supporting vehicle-maintenance safety, inspection, documentation of deficiencies, manufacturer-specification boundaries, and professional responsibility. Mapping is reference-only and does not create assessment eligibility.'
),
(
  'technical-writing-for-technicians-2019',
  'ug-aut101-foundations',
  'professional-documentation',
  'CC BY 4.0 supplemental reference for audience-aware technical communication, source-aware documentation, instructions, and professional reporting.'
),
(
  'osha-motor-vehicle-safety-aspects-2026',
  'ug-aut105-safety-professional-practice',
  'shop-safety-foundation',
  'Government safety reference for maintenance-related safety, inspection, documentation, and removal of unsafe vehicles from service. It supplements, but does not replace, applicable shop procedures, equipment instructions, or regulatory requirements.'
),
(
  'epa-automotive-sectors-regulatory-information-2026',
  'ug-aut105-safety-professional-practice',
  'environmental-compliance-reference',
  'Government environmental reference identifying automotive repair and maintenance as a regulated sector and linking applicable waste, refrigerant, solvent, and environmental compliance topics. Mapping is reference-only and does not authorize unsourced legal conclusions.'
),
(
  'technical-writing-for-technicians-2019',
  'ug-aut105-safety-professional-practice',
  'professional-documentation',
  'CC BY 4.0 supplemental reference for documenting hazards, procedures, evidence, escalation decisions, and professional communication.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
