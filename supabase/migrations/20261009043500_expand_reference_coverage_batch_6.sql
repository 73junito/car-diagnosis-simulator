-- Reference coverage Batch 6: complete graduate reference coverage with governed
-- systems-engineering, curriculum-design, and continuous-improvement sources.
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
  'nasa-systems-engineering-handbook-2016',
  'NASA Systems Engineering Handbook',
  'National Aeronautics and Space Administration',
  2016,
  'systems engineering',
  'technical-reference',
  'https://www.nasa.gov/reference/systems-engineering-handbook/',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'NASA is a U.S. federal agency. Federal-agency text is generally not protected by U.S. copyright under 17 U.S.C. 105. Source-level reproduction, database-storage, and AI/RAG permissions remain disabled here because third-party elements are not assumed public domain.'
),
(
  'openoregon-open-curriculum-development-model',
  'Open Curriculum Development Model',
  'Open Oregon Educational Resources',
  null,
  'curriculum and assessment design',
  'oer-textbook',
  'https://openoregon.pressbooks.pub/opencurriculum/',
  null,
  'CC_BY_4_0',
  true, true, true, true, true, true,
  true, false, 'student', 'active',
  'Open Oregon Educational Resources identifies the Open Curriculum Development Model as licensed under Creative Commons Attribution 4.0 except where otherwise noted. Attribution and third-party-item caveats remain applicable.'
),
(
  'ies-continuous-improvement-education-toolkit-2020',
  'Continuous Improvement in Education: A Toolkit for Schools and Districts',
  'U.S. Department of Education, Institute of Education Sciences / REL Northeast & Islands',
  2020,
  'educational continuous improvement',
  'technical-reference',
  'https://ies.ed.gov/use-work/resource-library/resource/other-resource/continuous-improvement-education-toolkit-schools-and-districts',
  null,
  'GOVERNMENT_HOSTED_CITATION_ONLY_PENDING_REUSE_REVIEW',
  true, false, false, false, false, false,
  true, false, 'student', 'active',
  'Authoritative U.S. Department of Education/IES-hosted continuous-improvement resource. Reuse rights beyond citation/linking have not been independently confirmed for all contributed material, so paraphrase, reproduction, database storage, AI/RAG ingestion, and commercial reuse remain disabled.'
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
  'nasa-systems-engineering-handbook-2016',
  'grad-aut501-integrated-systems',
  'systems-integration-foundation',
  'Government systems-engineering reference for system decomposition, interfaces, integration, verification, validation, technical management, and system-level reasoning. It supplies a cross-domain engineering foundation and is not an automotive service-information authority.'
),
(
  'openoregon-open-curriculum-development-model',
  'grad-curriculum-assessment-design',
  'curriculum-alignment-assessment-design',
  'CC BY 4.0 curriculum-design reference supporting outcome definition, backward design, alignment among outcomes/content/practice, assessment planning, assignments, rubrics, feedback, and iterative course improvement.'
),
(
  'technical-writing-for-technicians-2019',
  'grad-curriculum-assessment-design',
  'professional-documentation',
  'CC BY 4.0 supplemental reference for audience-aware technical communication, instructions, criteria, documentation, and source-aware reporting in technical curriculum development.'
),
(
  'ies-continuous-improvement-education-toolkit-2020',
  'grad-technical-instructional-leadership',
  'continuous-improvement-leadership',
  'Authoritative education-improvement reference supporting needs diagnosis, stakeholder participation, Plan-Do-Study-Act cycles, data collection, implementation, reflection, and evaluation. Citation-only rights controls remain in force.'
),
(
  'technical-writing-for-technicians-2019',
  'grad-technical-instructional-leadership',
  'stakeholder-technical-communication',
  'CC BY 4.0 supplemental reference for audience analysis, evidence-aware communication, documentation, and professional reporting used when communicating improvement decisions to technical stakeholders.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;