-- Supplemental automotive authority Batch 1.
-- Adds narrowly scoped, automotive-specific regulatory/service references to lessons that
-- were quantitatively covered but relied on broad foundational sources alone.
-- No evidence approval, assessment eligibility, or model-ingestion authority is granted.

insert into public.curriculum_reference_sources (
  id, title, publisher, publication_year, subject_area, source_kind,
  canonical_url, local_filename, license_classification,
  citation_link_allowed, paraphrase_summary_allowed, direct_reproduction_allowed,
  database_storage_allowed, ai_rag_ingestion_allowed, commercial_use_allowed,
  attribution_required, share_alike_required, audience, status, rights_basis
) values
(
  'nhtsa-fmvss-135-light-vehicle-brake-systems',
  'FMVSS No. 135 - Light Vehicle Brake Systems',
  'National Highway Traffic Safety Administration',
  null,
  'automotive brake systems and performance requirements',
  'technical-reference',
  'https://www.nhtsa.gov/interpretations/11-005927-kro-std-no-135',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'NHTSA is a U.S. Department of Transportation agency. Federal-agency text is generally not protected by U.S. copyright under 17 U.S.C. 105. Direct reproduction, database storage, and AI/RAG remain disabled because this mapping is for regulatory/performance context, not source ingestion, and third-party material is not assumed public domain.'
),
(
  'nhtsa-fmvss-126-electronic-stability-control',
  'FMVSS No. 126 - Electronic Stability Control Systems',
  'National Highway Traffic Safety Administration',
  2007,
  'vehicle stability control and steering response',
  'technical-reference',
  'https://www.nhtsa.gov/document/final-rule-federal-motor-vehicle-safety-standards-electronic-stability-control-systems-0',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'NHTSA is a U.S. Department of Transportation agency. Federal-agency text is generally not protected by U.S. copyright under 17 U.S.C. 105. Direct reproduction, database storage, and AI/RAG remain disabled because this source is used only for stability-control performance and steering-response context.'
),
(
  'epa-mvac-section-609-servicing-2026',
  'Regulatory Requirements for MVAC System Servicing',
  'U.S. Environmental Protection Agency',
  2026,
  'motor vehicle air conditioning service and refrigerant handling',
  'technical-reference',
  'https://www.epa.gov/mvac/regulatory-requirements-mvac-system-servicing',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'EPA is a U.S. federal agency. Federal-agency text is generally not protected by U.S. copyright under 17 U.S.C. 105. Direct reproduction, database storage, and AI/RAG remain disabled because linked standards, equipment lists, and third-party content are not assumed public domain.'
),
(
  'epa-vehicle-emissions-im-obd-guidance-2026',
  'Vehicle Emissions Inspection and Maintenance: Policy and Technical Guidance',
  'U.S. Environmental Protection Agency',
  2026,
  'vehicle emissions inspection and onboard diagnostics',
  'technical-reference',
  'https://www.epa.gov/state-and-local-transportation/vehicle-emissions-inspection-and-maintenance-im-policy-and-technical',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'EPA is a U.S. federal agency. Federal-agency text is generally not protected by U.S. copyright under 17 U.S.C. 105. Direct reproduction, database storage, and AI/RAG remain disabled because this record points to policy and technical guidance collections that may include contributed or linked material.'
),
(
  'bccampus-diesel-drivetrain-systems-directory-record',
  'Diesel Drivetrain Systems',
  'BCcampus Open Education / SkillsCommons',
  2018,
  'automotive drivetrain and transmission systems',
  'oer-textbook',
  'https://opentextbc.ca/oerdiscipline/chapter/automotive/',
  null,
  'CC_BY_4_0_DIRECTORY_VERIFIED_COURSE_LISTING',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'BCcampus OER by Discipline lists Diesel Drivetrain Systems as CC BY and describes coverage of manual transmissions, automatic transmissions, clutches, drivelines, differentials, troubleshooting, inspection, service, repair, removal, replacement, and preventive maintenance. Direct reproduction, database storage, and AI/RAG remain disabled until the exact SkillsCommons artifact and license metadata are independently captured and verified.'
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
  'nhtsa-fmvss-135-light-vehicle-brake-systems',
  'ug-brakes-foundations',
  'brake-system-regulatory-performance-reference',
  'Automotive-specific federal brake-system reference supporting performance requirements, hot/cold effectiveness context, parking-brake requirements, and the regulatory boundary for brake-system safety. It supplements but does not replace manufacturer service procedures or specifications.'
),
(
  'nhtsa-fmvss-126-electronic-stability-control',
  'ug-suspension-steering-foundations',
  'stability-control-steering-response-reference',
  'Automotive-specific federal reference supporting yaw stability, steering input, lateral response, individual-wheel brake intervention, and ESC system context. It supplements but does not replace alignment, steering, or suspension service information.'
),
(
  'epa-mvac-section-609-servicing-2026',
  'ug-aut170-hvac-systems',
  'mvac-regulatory-service-reference',
  'Automotive-specific EPA reference supporting Section 609 technician certification, approved refrigerant-handling equipment, refrigerant recovery/recycling requirements, and service-practice boundaries for MVAC work.'
),
(
  'epa-vehicle-emissions-im-obd-guidance-2026',
  'ug-aut270-emissions-systems',
  'emissions-obd-regulatory-reference',
  'Automotive-specific EPA reference supporting emissions inspection and maintenance, OBD readiness, inspection-process context, and the relationship between high-emissions findings and repair requirements.'
),
(
  'bccampus-diesel-drivetrain-systems-directory-record',
  'ug-aut160-drivetrain-systems',
  'drivetrain-service-foundation',
  'Automotive drivetrain course reference covering manual transmissions, clutches, drivelines, differentials, troubleshooting, inspection, service, repair, removal, replacement, and preventive maintenance. Exact artifact ingestion remains blocked pending independent artifact/license capture.'
),
(
  'bccampus-diesel-drivetrain-systems-directory-record',
  'ug-aut220-automatic-transmissions',
  'transmission-service-foundation',
  'Automotive drivetrain course reference explicitly covering automatic transmissions together with troubleshooting, inspection, service, repair, removal, replacement, and preventive maintenance. Exact artifact ingestion remains blocked pending independent artifact/license capture.'
),
(
  'nhtsa-electric-hybrid-vehicle-safety-2026',
  'ug-aut320-hybrid-vehicle-technology',
  'electrified-vehicle-safety-reference',
  'Existing NHTSA EV/HEV safety reference supplements the physics-based energy-systems foundation with automotive-specific high-voltage architecture, battery, charging, and safety context. It does not replace manufacturer service information.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
