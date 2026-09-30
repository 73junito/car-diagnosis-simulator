insert into public.curriculum_reference_mappings (
  reference_id, lesson_plan_id, role, notes
) values
(
  'technical-writing-for-technicians-2019',
  'grad-applied-research-literature',
  'research-communication',
  'Supports scholarly source use, synthesis, audience awareness, technical documentation, and evidence-based research communication.'
),
(
  'technical-writing-for-technicians-2019',
  'grad-aut590-technology-seminar',
  'technical-communication',
  'Supports critical technical review, source-aware writing, concise synthesis, and communication of emerging technology findings.'
),
(
  'technical-writing-for-technicians-2019',
  'ug-aut400-research-methods',
  'research-communication',
  'Supports technical research questions, source documentation, audience awareness, methods reporting, and evidence-based writing.'
),
(
  'technical-writing-for-technicians-2019',
  'ug-aut420-internship',
  'professional-documentation',
  'Supports professional documentation, workplace communication, reflective technical writing, and evidence-based reporting.'
),
(
  'openstax-principles-data-science-2025',
  'grad-aut515-systems-modeling',
  'data-modeling-foundation',
  'Reference-only data-science background for modeling, variables, validation, uncertainty, visualization, and interpretation. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-principles-data-science-2025',
  'grad-aut560-adas-perception',
  'data-analysis-foundation',
  'Reference-only data-science background for multivariable data, visualization, uncertainty, validation, and evidence interpretation in perception systems. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-principles-data-science-2025',
  'grad-aut565-autonomous-systems',
  'data-analysis-foundation',
  'Reference-only data-science background for data interpretation, uncertainty, model validation, and evidence-based analysis in autonomous systems. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-principles-data-science-2025',
  'grad-aut585-digital-twins',
  'data-modeling-foundation',
  'Reference-only data-science background for modeling, data preparation, visualization, uncertainty, validation, and predictive interpretation. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-principles-data-science-2025',
  'ug-aut350-adas',
  'data-analysis-foundation',
  'Reference-only data-science background for sensor data interpretation, visualization, uncertainty, calibration evidence, and validation reasoning. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-principles-data-science-2025',
  'grad-diagnostic-evidence-analysis',
  'diagnostic-data-foundation',
  'Reference-only data-science background for evidence interpretation, visualization, uncertainty, comparison, and analytical reasoning. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-principles-data-science-2025',
  'grad-vehicle-systems-testing',
  'testing-data-foundation',
  'Reference-only data-science background for experimental data, visualization, uncertainty, validation, and interpretation of vehicle test results. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'fiore-ac-electrical-circuit-analysis-2021',
  'grad-aut540-power-electronics',
  'electrical-theory-reference',
  'Reference-only electrical-circuit background for waveform, impedance, power, phase, and circuit-analysis concepts supporting power-electronics study. Noncommercial terms prohibit production content reuse.'
),
(
  'fiore-ac-electrical-circuit-analysis-2021',
  'grad-aut580-control-systems',
  'electrical-theory-reference',
  'Reference-only electrical-circuit background for signals, frequency response, phase relationships, and measurement concepts supporting control-system analysis. Noncommercial terms prohibit production content reuse.'
),
(
  'fiore-ac-electrical-circuit-analysis-2021',
  'ug-aut230-automotive-electronics',
  'electrical-theory-reference',
  'Reference-only electrical-circuit background for signals, impedance, waveform behavior, phase, and measurement concepts in automotive electronics. Noncommercial terms prohibit production content reuse.'
),
(
  'openstax-chemistry-2e-2026',
  'ug-aut270-emissions-systems',
  'chemistry-foundation',
  'Reference-only chemistry background for reactions, gases, equilibrium, catalysis, and material behavior supporting emissions and aftertreatment concepts. The source remains noncommercial and is not ingested into AI/RAG.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
