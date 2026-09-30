insert into public.curriculum_reference_sources (
  id, title, publisher, publication_year, subject_area, source_kind,
  canonical_url, local_filename, license_classification,
  citation_link_allowed, paraphrase_summary_allowed, direct_reproduction_allowed,
  database_storage_allowed, ai_rag_ingestion_allowed, commercial_use_allowed,
  attribution_required, share_alike_required, audience, status, rights_basis
) values
(
  'bccampus-basic-motor-control-2020',
  'Basic Motor Control',
  'BCcampus',
  2020,
  'electrical controls',
  'oer-textbook',
  'https://collection.bccampus.ca/textbook/JHXNWpbL/',
  null,
  'CC_BY_4_0',
  true, true, true, true, true, true,
  true, false, 'student', 'active',
  'BCcampus textbook record states CC BY 4.0 except where otherwise noted and explicitly permits sharing, adaptation, and commercial use with attribution.'
),
(
  'nhtsa-electric-hybrid-vehicle-safety-2026',
  'Electric and Hybrid Vehicles: Battery, Charging & Safety',
  'National Highway Traffic Safety Administration',
  null,
  'electric vehicle safety',
  'technical-reference',
  'https://www.nhtsa.gov/vehicle-safety/electric-and-hybrid-vehicles',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'NHTSA is a U.S. Department of Transportation agency. DOT policy states information it produces is free from U.S. copyright protection under 17 U.S.C. 105. Source-level reproduction, database-storage, and AI/RAG permissions remain disabled here because third-party elements on the page are not assumed public domain.'
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
('openstax-university-physics-v1-2026', 'ug-aut115-measurement-instrumentation', 'measurement-foundation',
 'Reference-only physics foundation for units, measurement, uncertainty, instrument interpretation, and quantitative physical reasoning. Existing noncommercial controls remain unchanged.'),
('openstax-university-physics-v1-2026', 'ug-aut131-engine-lab', 'engineering-mechanics-foundation',
 'Reference-only mechanics and measurement background for force, motion, work, energy, dimensional reasoning, and laboratory measurement. Existing noncommercial controls remain unchanged.'),
('technical-writing-for-technicians-2019', 'ug-aut131-engine-lab', 'laboratory-documentation',
 'Supports technician-facing laboratory documentation, procedural clarity, measurement reporting, and source-aware technical communication under the existing CC BY 4.0 permissions.'),
('openstax-university-physics-v1-2026', 'ug-aut200-engine-systems-ii', 'engineering-mechanics-foundation',
 'Reference-only physics background for forces, motion, work, energy, rotational relationships, and mechanical-system reasoning. Existing noncommercial controls remain unchanged.'),
('openstax-university-physics-v1-2026', 'ug-aut201-engine-systems-ii-lab', 'engineering-mechanics-foundation',
 'Reference-only mechanics and quantitative measurement background for engine-mechanical laboratory analysis. Existing noncommercial controls remain unchanged.'),
('bccampus-basic-motor-control-2020', 'ug-aut280-control-systems', 'control-systems-foundation',
 'CC BY 4.0 foundation for electrical control devices, relay logic, AC/DC control concepts, motor-control circuits, and troubleshooting-oriented control reasoning; not an automotive ECU-specific authority.'),
('nhtsa-electric-hybrid-vehicle-safety-2026', 'ug-hev-foundations', 'high-voltage-safety-reference',
 'Government technical reference for EV/HEV high-voltage service boundaries, specialized technician training, PPE, and diagnostic/test equipment expectations. Mapping does not grant assessment eligibility or whole-page ingestion rights.')
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
