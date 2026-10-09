-- Supplemental automotive authority Batch 4.
-- Adds U.S. Department of Energy / Alternative Fuels Data Center references for
-- electric-drive architecture, batteries, power electronics, and hybrid energy flow.
-- These references supplement automotive-domain authority without granting
-- evidence approval, scored-assessment eligibility, direct reproduction, or AI/RAG rights.

insert into public.curriculum_reference_sources (
  id, title, publisher, publication_year, subject_area, source_kind,
  canonical_url, local_filename, license_classification,
  citation_link_allowed, paraphrase_summary_allowed, direct_reproduction_allowed,
  database_storage_allowed, ai_rag_ingestion_allowed, commercial_use_allowed,
  attribution_required, share_alike_required, audience, status, rights_basis
) values
(
  'doe-afdc-all-electric-car-architecture',
  'How Do All-Electric Cars Work?',
  'U.S. Department of Energy Alternative Fuels Data Center',
  null,
  'battery electric vehicle architecture, traction batteries, converters, electric drive, charging, and thermal systems',
  'technical-reference',
  'https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official U.S. Department of Energy AFDC vehicle-architecture reference. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because federal pages may include third-party images, marks, or incorporated material requiring separate review.'
),
(
  'doe-afdc-hybrid-electric-car-architecture',
  'How Do Hybrid Electric Cars Work?',
  'U.S. Department of Energy Alternative Fuels Data Center',
  null,
  'hybrid electric vehicle architecture, regenerative braking, traction batteries, power electronics, and energy flow',
  'technical-reference',
  'https://afdc.energy.gov/vehicles/how-do-hybrid-electric-cars-work',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official U.S. Department of Energy AFDC hybrid-vehicle architecture reference. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because federal pages may include third-party images, marks, or incorporated material requiring separate review.'
),
(
  'doe-vto-batteries',
  'Batteries',
  'U.S. Department of Energy Transportation Technologies Office',
  null,
  'electric-drive batteries, performance, durability, abuse tolerance, materials, diagnostics, and applied battery research',
  'technical-reference',
  'https://www.energy.gov/cmei/vehicles/batteries',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official U.S. Department of Energy battery research reference. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled because linked reports, images, and incorporated third-party material may carry separate rights.'
),
(
  'doe-vto-power-electronics-rd',
  'Power Electronics Research and Development',
  'U.S. Department of Energy Transportation Technologies Office',
  null,
  'vehicle power electronics, inverters, DC/DC conversion, motor control, chargers, electrical energy flow, and thermal reliability',
  'technical-reference',
  'https://www.energy.gov/cmei/vehicles/power-electronics-research-and-development',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official U.S. Department of Energy vehicle power-electronics reference. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled pending separate review of any incorporated third-party content.'
),
(
  'doe-vto-electric-drive-systems-rd',
  'Electric Drive Systems Research and Development',
  'U.S. Department of Energy Transportation Technologies Office',
  null,
  'electric motors, inverters, boost converters, onboard chargers, electric-drive integration, efficiency, reliability, and thermal management',
  'technical-reference',
  'https://www.energy.gov/cmei/vehicles/electric-drive-systems-research-and-development',
  null,
  'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
  true, true, false, false, false, true,
  true, false, 'student', 'active',
  'Official U.S. Department of Energy electric-drive systems reference. Citation/link and project-authored factual summary are allowed. Direct reproduction, database storage, and AI/RAG ingestion remain disabled pending separate review of linked or incorporated material.'
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
  'doe-vto-power-electronics-rd',
  'ug-aut230-automotive-electronics',
  'vehicle-power-electronics-reference',
  'DOE vehicle power-electronics guidance supplements general circuit theory with automotive inverters, DC/DC conversion, motor control, chargers, energy-flow control, and thermal-reliability context.'
),
(
  'doe-vto-power-electronics-rd',
  'ug-aut280-control-systems',
  'electric-drive-control-reference',
  'DOE guidance supplements general motor-control foundations with automotive power-electronics control of motor speed, torque, conversion, and distribution of electrical energy.'
),
(
  'doe-afdc-hybrid-electric-car-architecture',
  'ug-aut321-hybrid-lab',
  'hybrid-architecture-energy-flow-reference',
  'DOE AFDC hybrid-vehicle architecture supports laboratory interpretation of traction batteries, regenerative braking, motor-generator behavior, DC/DC conversion, and power-electronics energy flow.'
),
(
  'doe-afdc-all-electric-car-architecture',
  'ug-aut331-electric-vehicle-lab',
  'bev-architecture-component-reference',
  'DOE AFDC battery-electric architecture supports laboratory identification and interpretation of traction batteries, charge ports, DC/DC converters, electric traction motors, power electronics, and thermal systems.'
),
(
  'doe-vto-electric-drive-systems-rd',
  'ug-hev-foundations',
  'electric-drive-systems-reference',
  'DOE electric-drive systems guidance supplements the existing safety reference with automotive-domain architecture and integration of motors, inverters, boost converters, onboard chargers, efficiency, and reliability.'
),
(
  'doe-afdc-all-electric-car-architecture',
  'grad-aut530-advanced-ev-systems',
  'bev-system-architecture-reference',
  'DOE AFDC architecture provides automotive-domain context for traction-energy storage, conversion, charging, motor drive, auxiliaries, and thermal systems in battery-electric vehicles.'
),
(
  'doe-vto-batteries',
  'grad-aut535-battery-systems',
  'vehicle-battery-rd-reference',
  'DOE battery research supplements electrochemistry fundamentals with vehicle-oriented performance, power, energy, durability, abuse tolerance, failure analysis, diagnostics, and applied battery research.'
),
(
  'doe-vto-power-electronics-rd',
  'grad-aut540-power-electronics',
  'vehicle-power-electronics-rd-reference',
  'DOE guidance directly supports graduate study of vehicle inverters, DC/DC conversion, chargers, motor control, energy conversion, thermal constraints, efficiency, and reliability.'
),
(
  'doe-afdc-hybrid-electric-car-architecture',
  'grad-aut545-energy-management',
  'hybrid-energy-flow-reference',
  'DOE AFDC hybrid architecture supports analysis of regenerative braking, engine/motor interaction, traction-battery energy flow, auxiliary loads, and power-electronics control.'
),
(
  'doe-vto-electric-drive-systems-rd',
  'grad-aut545-energy-management',
  'electric-drive-integration-reference',
  'DOE electric-drive systems guidance supplements energy-flow analysis with component integration, efficiency, power conversion, thermal management, and system-level reliability objectives.'
),
(
  'doe-vto-power-electronics-rd',
  'grad-aut580-control-systems',
  'electric-drive-control-and-conversion-reference',
  'DOE vehicle power-electronics guidance supplements control-theory foundations with motor speed/torque control, inverter behavior, DC/DC conversion, charger functions, and distribution of electrical power.'
),
(
  'doe-vto-electric-drive-systems-rd',
  'grad-vehicle-systems-testing',
  'electric-drive-validation-context-reference',
  'DOE electric-drive systems R&D provides automotive validation context for performance, efficiency, reliability, thermal management, integration, and manufacturability objectives used when planning advanced vehicle-system testing.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
