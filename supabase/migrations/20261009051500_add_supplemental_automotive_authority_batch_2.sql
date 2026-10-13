-- Supplemental automotive authority Batch 2.
-- Adds citation-only automotive/scholarly authorities for charging, diagnostics,
-- vehicle networks, battery management, and ADAS.
-- These records do not grant evidence approval, assessment eligibility, or model-ingestion rights.

insert into public.curriculum_reference_sources (
  id, title, publisher, publication_year, subject_area, source_kind,
  canonical_url, local_filename, license_classification,
  citation_link_allowed, paraphrase_summary_allowed, direct_reproduction_allowed,
  database_storage_allowed, ai_rag_ingestion_allowed, commercial_use_allowed,
  attribution_required, share_alike_required, audience, status, rights_basis
) values
(
  'bosch-alternator-technical-poster-2020',
  'Alternator - Compact alternator',
  'Robert Bosch GmbH',
  2020,
  'automotive charging systems and alternator construction',
  'technical-reference',
  'https://www.boschaftermarket.com/xrm/media/images/parts/starters_and_alternators/pdf_43/en/poster_bosch_three_phase_alternator.pdf',
  null,
  'PROPRIETARY_CITATION_ONLY_REUSE_UNVERIFIED',
  true, false, false, false, false, false,
  true, false, 'student', 'active',
  'Registered from the project external-technical-reference registry. Bosch material is citation/link metadata only because a reuse license has not been established. No excerpts, figures, database storage, AI/RAG ingestion, or commercial reuse are authorized.'
),
(
  'automotive-engine-diagnostic-survey-2012',
  'A survey on diagnostic methods for automotive engines',
  'International Journal of Engine Research / SAGE',
  2012,
  'automotive engine fault detection and diagnostic methods',
  'technical-reference',
  'https://doi.org/10.1177/1468087411422851',
  null,
  'SCHOLARLY_CITATION_ONLY_REUSE_UNVERIFIED',
  true, false, false, false, false, false,
  true, false, 'student', 'active',
  'Peer-reviewed diagnostic-method reference already registered in the AUT-250 source review as metadata-and-link-only. Rights for source-text reuse, database storage, AI/RAG ingestion, and commercial reuse have not been independently cleared.'
),
(
  'sae-nissan-can-diagnostic-flow-2014',
  'Network Diagnostic Flow Chart-How to Troubleshoot Vehicle Level CAN Communication and CAN Diagnostic Issues on Nissan and Infinity Vehicles',
  'SAE International',
  2014,
  'automotive CAN network diagnostics',
  'technical-reference',
  'https://doi.org/10.4271/2014-01-1978',
  null,
  'SAE_CITATION_ONLY_NO_AI_REUSE',
  true, false, false, false, false, false,
  true, false, 'student', 'active',
  'OEM-authored SAE automotive technical paper already registered as citation support only. SAE content reuse and AI use remain blocked absent explicit permission. This record stores bibliographic metadata and a link only.'
),
(
  'icar-adas-diagnostic-process-2025',
  'Advanced Driver Assistance Systems (ADAS) Collision Repair Diagnostics Process',
  'I-CAR',
  2025,
  'ADAS diagnostic process and OEM information use',
  'technical-reference',
  'https://rts.i-car.com/crn-642.html',
  null,
  'PROPRIETARY_CITATION_ONLY_REUSE_UNVERIFIED',
  true, false, false, false, false, false,
  true, false, 'student', 'active',
  'Industry repair-training guidance already registered as metadata-and-link-only. No source-text reproduction, database storage, AI/RAG ingestion, or commercial reuse is authorized without a separate rights review.'
),
(
  'scholar-battery-soc-soh-review-2023',
  'A Systematic Literature Review of State of Health and State of Charge Estimation Methods for Batteries Used in Electric Vehicle Applications',
  'World Electric Vehicle Journal / MDPI',
  2023,
  'EV battery state-of-charge and state-of-health estimation',
  'technical-reference',
  'https://doi.org/10.3390/wevj14090247',
  null,
  'SCHOLARLY_CITATION_ONLY_REUSE_UNVERIFIED',
  true, false, false, false, false, false,
  true, false, 'student', 'active',
  'Peer-reviewed EV battery review already registered in the AUT-250 source review as metadata-and-link-only. Exact article reuse rights have not been independently promoted into the curriculum-reference rights workflow, so reuse/storage/RAG/commercial permissions remain disabled.'
),
(
  'gm-pre-post-scan-position-2022',
  'Pre- and Post-Scan of Collision Vehicles',
  'General Motors',
  2022,
  'automotive diagnostic verification and post-repair scanning',
  'technical-reference',
  'https://www.gmparts.com/content/dam/gmparts/na/us/en/index/technical-resources/position-statements/02-pdfs/new/pre-post-scan-collision-vehicles.pdf',
  null,
  'OEM_CITATION_ONLY_REUSE_UNVERIFIED',
  true, false, false, false, false, false,
  true, false, 'student', 'active',
  'OEM position statement already registered as candidate citation support. It is used for verification and post-repair scanning context only. No source-text reuse, database storage, AI/RAG ingestion, or commercial reuse is authorized.'
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
  'bosch-alternator-technical-poster-2020',
  'ug-electrical-charging-system',
  'charging-system-component-reference',
  'Supplier-authored automotive alternator reference supporting rotor/stator, excitation, rectification, and charging-system component relationships. Citation-only; vehicle-specific service values and procedures remain outside scope.'
),
(
  'bosch-alternator-technical-poster-2020',
  'ug-aut240-electrical-systems-ii',
  'charging-system-architecture-reference',
  'Automotive-specific alternator architecture supplements general circuit theory for advanced electrical-system analysis. Citation-only and not a substitute for applicable OEM service information.'
),
(
  'automotive-engine-diagnostic-survey-2012',
  'ug-engine-performance-foundations',
  'automotive-diagnostic-methods-reference',
  'Peer-reviewed automotive-engine diagnostic survey supplements the data-science foundation with automotive fault-detection, fault-isolation, model-based, and data-driven diagnostic context.'
),
(
  'automotive-engine-diagnostic-survey-2012',
  'ug-aut250-automotive-diagnostics-i',
  'automotive-diagnostic-methods-reference',
  'Peer-reviewed automotive diagnostic-method reference supporting systematic fault detection and isolation. It does not authorize any specific repair procedure or assessment content.'
),
(
  'gm-pre-post-scan-position-2022',
  'ug-aut300-advanced-diagnostics',
  'post-repair-verification-reference',
  'OEM diagnostic position statement supplements data-science reasoning with automotive-specific pre/post scan and post-repair verification context. OEM procedures remain authoritative for vehicle-specific work.'
),
(
  'sae-nissan-can-diagnostic-flow-2014',
  'ug-aut310-network-communications',
  'vehicle-can-diagnostic-reference',
  'OEM-authored SAE paper supplements general computer-science concepts with vehicle-level CAN troubleshooting across modules and buses. Citation-only under the existing SAE rights boundary.'
),
(
  'scholar-battery-soc-soh-review-2023',
  'ug-aut340-battery-management',
  'battery-state-estimation-reference',
  'Peer-reviewed EV battery review supplements chemistry fundamentals with SOC/SOH estimation methods and the use of voltage, current, and temperature evidence. Citation-only pending separate rights review.'
),
(
  'icar-adas-diagnostic-process-2025',
  'ug-aut350-adas',
  'adas-diagnostic-process-reference',
  'Industry ADAS diagnostic guidance supplements data-analysis foundations with automotive-specific pre-scan, communication readiness, OEM-information, and post-repair diagnostic context. Citation-only.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
