-- Reference quality authority-independence refinement.
-- Adds narrowly scoped, already-governed authorities to the final two concentration cases.
-- No source rights, evidence approvals, or assessment eligibility are changed.

insert into public.curriculum_reference_mappings (
  reference_id, lesson_plan_id, role, notes
) values
(
  'doe-vto-electric-drive-systems-rd',
  'grad-aut501-integrated-systems',
  'automotive-systems-integration-case-reference',
  'DOE electric-drive systems research adds automotive-specific integration context across motors, inverters, converters, charging, thermal management, efficiency, reliability, and vehicle-level subsystem interaction.'
),
(
  'ies-continuous-improvement-education-toolkit-2020',
  'grad-curriculum-assessment-design',
  'assessment-improvement-cycle-reference',
  'The IES continuous-improvement toolkit supplements curriculum-design guidance with an independent evidence-informed improvement-cycle framework for using measures, implementation evidence, and iterative evaluation.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
