insert into public.curriculum_reference_mappings (
  reference_id, lesson_plan_id, role, notes
) values
(
  'openstax-chemistry-2e-2026',
  'ug-aut170-hvac-systems',
  'chemistry-foundation',
  'Reference-only chemistry background for refrigerants, phase behavior, pressure-temperature relationships, and material handling context. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-chemistry-2e-2026',
  'ug-aut340-battery-management',
  'electrochemistry-foundation',
  'Reference-only chemistry background for cell reactions, materials, thermal behavior, and battery degradation context. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-chemistry-2e-2026',
  'grad-aut535-battery-systems',
  'electrochemistry-foundation',
  'Reference-only graduate background for battery chemistry, degradation, thermal influences, and model assumptions. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-additive-manufacturing-essentials-2025',
  'ug-aut450-capstone-i',
  'design-prototyping-reference',
  'Reference-only manufacturing context for design constraints, prototyping options, process selection, and project planning. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-additive-manufacturing-essentials-2025',
  'ug-aut451-capstone-ii',
  'design-prototyping-reference',
  'Reference-only manufacturing context for prototype realization, testing, verification, documentation, and limitations. The source remains noncommercial and is not ingested into AI/RAG.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;