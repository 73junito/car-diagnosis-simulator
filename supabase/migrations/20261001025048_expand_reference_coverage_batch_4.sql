-- Reference coverage Batch 4: map only lessons with clear support from existing governed sources.
-- These mappings are supplemental references only and do not grant evidence approval,
-- AI/RAG rights, direct-reproduction rights, or assessment eligibility.

insert into public.curriculum_reference_mappings (
  reference_id, lesson_plan_id, role, notes
) values
(
  'openstax-principles-data-science-2025',
  'ug-engine-performance-foundations',
  'diagnostic-data-foundation',
  'Reference-only data-science background for operating-data interpretation, comparison, uncertainty, visualization, and evidence-based reasoning. Existing noncommercial and no-AI/RAG controls remain unchanged.'
),
(
  'openstax-principles-data-science-2025',
  'ug-aut211-engine-performance-lab',
  'testing-data-foundation',
  'Reference-only data-science background for test-data collection, context, visualization, uncertainty, comparison, and interpretation in laboratory work. Existing noncommercial and no-AI/RAG controls remain unchanged.'
),
(
  'technical-writing-for-technicians-2019',
  'ug-aut211-engine-performance-lab',
  'laboratory-documentation',
  'Supports technician-facing laboratory documentation, measurement context, concise evidence reporting, and source-aware technical communication under existing CC BY 4.0 permissions.'
),
(
  'openstax-principles-data-science-2025',
  'ug-aut250-automotive-diagnostics-i',
  'diagnostic-data-foundation',
  'Reference-only analytical background for organizing observations, comparing data, recognizing uncertainty, forming testable questions, and interpreting evidence. It is not an automotive diagnostic authority and existing no-AI/RAG controls remain unchanged.'
),
(
  'openstax-principles-data-science-2025',
  'ug-aut251-diagnostics-lab',
  'testing-data-foundation',
  'Reference-only data-science background for evidence collection, comparison, uncertainty, visualization, and fault-isolation reasoning in laboratory work. It is not an automotive service-information source and existing no-AI/RAG controls remain unchanged.'
),
(
  'technical-writing-for-technicians-2019',
  'ug-aut251-diagnostics-lab',
  'laboratory-documentation',
  'Supports structured laboratory notes, observation-versus-conclusion clarity, procedural reporting, and source-aware technical documentation under existing CC BY 4.0 permissions.'
),
(
  'openstax-principles-data-science-2025',
  'ug-aut300-advanced-diagnostics',
  'diagnostic-data-foundation',
  'Reference-only analytical background for multivariable evidence, uncertainty, comparison, hypothesis discrimination, and validation reasoning. It is not an automotive diagnostic authority and existing no-AI/RAG controls remain unchanged.'
),
(
  'openstax-principles-data-science-2025',
  'ug-aut301-advanced-diagnostics-lab',
  'testing-data-foundation',
  'Reference-only data-analysis background for experimental context, cross-variable comparison, uncertainty, visualization, and validation of laboratory findings. Existing noncommercial and no-AI/RAG controls remain unchanged.'
),
(
  'technical-writing-for-technicians-2019',
  'ug-aut301-advanced-diagnostics-lab',
  'laboratory-documentation',
  'Supports evidence-chain documentation, procedural clarity, concise technical reporting, and source-aware communication under existing CC BY 4.0 permissions.'
),
(
  'nhtsa-electric-hybrid-vehicle-safety-2026',
  'ug-aut321-hybrid-lab',
  'high-voltage-safety-reference',
  'Government technical reference for hybrid/electric high-voltage service boundaries, specialized technician training, PPE, and diagnostic/test-equipment expectations. Mapping does not grant whole-page ingestion or assessment eligibility.'
),
(
  'nhtsa-electric-hybrid-vehicle-safety-2026',
  'ug-aut331-electric-vehicle-lab',
  'high-voltage-safety-reference',
  'Government technical reference for EV high-voltage and charging safety boundaries, specialized technician training, PPE, and diagnostic/test-equipment expectations. Mapping does not grant whole-page ingestion or assessment eligibility.'
),
(
  'openstax-introduction-computer-science-2026',
  'ug-aut410-systems-integration',
  'computing-systems-foundation',
  'Reference-only computing background for system decomposition, data flow, interfaces, abstraction, software-hardware interaction, and cross-domain reasoning. Existing noncommercial and no-AI/RAG controls remain unchanged.'
),
(
  'bccampus-basic-motor-control-2020',
  'ug-aut410-systems-integration',
  'control-systems-foundation',
  'CC BY 4.0 supplemental foundation for control devices, relay logic, electrical control relationships, and troubleshooting-oriented system reasoning; not an automotive architecture authority.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
