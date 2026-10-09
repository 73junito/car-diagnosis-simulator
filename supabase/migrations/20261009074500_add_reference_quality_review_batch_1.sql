-- Reference quality/depth review Batch 1.
-- Strengthens eight automotive technical lessons using existing governed sources.
-- Cross-domain lessons (measurement, digital twins, curriculum/assessment, and instructional
-- leadership) are handled by the quality audit's direct-domain-authority rules rather than by
-- adding weak automotive mappings solely to satisfy a generic automotive-domain heuristic.
-- No mapping in this migration grants evidence approval or scored-assessment eligibility.

insert into public.curriculum_reference_mappings (
  reference_id, lesson_plan_id, role, notes
) values
(
  'automotive-engine-diagnostic-survey-2012',
  'grad-aut520-data-analytics',
  'automotive-diagnostic-data-application-reference',
  'The peer-reviewed automotive diagnostic survey adds domain-specific diagnostic-method and vehicle-data application context to the lesson''s data-science and measurement-uncertainty foundations.'
),
(
  'doe-internal-combustion-engine-basics',
  'ug-aut131-engine-lab',
  'engine-laboratory-system-context-reference',
  'DOE engine architecture and operating-cycle guidance adds automotive engine-system context to laboratory inspection, measurement, and documentation activities.'
),
(
  'automotive-engine-diagnostic-survey-2012',
  'ug-aut211-engine-performance-lab',
  'engine-performance-diagnostic-methods-reference',
  'The peer-reviewed automotive diagnostic survey supplements data and documentation foundations with automotive engine fault-detection and diagnostic-method context.'
),
(
  'gm-pre-post-scan-position-2022',
  'ug-aut251-diagnostics-lab',
  'oem-diagnostic-verification-reference',
  'The GM position statement provides OEM-authored diagnostic verification and scan-process context for laboratory evidence collection and fault isolation.'
),
(
  'sae-nissan-can-diagnostic-flow-2014',
  'ug-aut301-advanced-diagnostics-lab',
  'vehicle-network-diagnostic-flow-reference',
  'The SAE/Nissan CAN diagnostic flow supplements advanced laboratory fault isolation with vehicle-network diagnostic sequence and communication-system troubleshooting context.'
),
(
  'sae-nissan-can-diagnostic-flow-2014',
  'ug-aut360-data-analysis',
  'vehicle-network-data-interpretation-reference',
  'The SAE/Nissan CAN diagnostic flow adds automotive network-data and diagnostic interpretation context to general computing and data-science foundations.'
),
(
  'automotive-engine-diagnostic-survey-2012',
  'ug-aut400-research-methods',
  'automotive-research-literature-example',
  'The peer-reviewed automotive diagnostic survey provides a domain-specific research example for framing questions, evaluating methods, interpreting evidence, and discussing limitations.'
),
(
  'nhtsa-cybersecurity-best-practices-modern-vehicles-2022',
  'ug-aut410-systems-integration',
  'vehicle-architecture-integration-reference',
  'NHTSA vehicle cybersecurity guidance supplements control and computing foundations with automotive electronic architecture, in-vehicle network, software-update, and cross-domain integration context.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
