insert into public.curriculum_reference_mappings (
  reference_id, lesson_plan_id, role, notes
) values
(
  'openstax-university-physics-v1-2026',
  'ug-aut130-engine-systems',
  'physics-foundation',
  'Reference-only mechanics and energy background for force, work, power, motion, and system relationships. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-university-physics-v1-2026',
  'ug-aut160-drivetrain-systems',
  'engineering-mechanics-foundation',
  'Reference-only mechanics background for torque, rotational motion, energy transfer, and drivetrain relationships. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-university-physics-v1-2026',
  'ug-aut220-automatic-transmissions',
  'engineering-mechanics-foundation',
  'Reference-only mechanics and energy background for rotational motion, torque transfer, and transmission-system relationships. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-university-physics-v1-2026',
  'ug-aut260-vehicle-dynamics',
  'vehicle-dynamics-foundation',
  'Reference-only physics background for force, acceleration, friction, momentum, and stability relationships. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-university-physics-v1-2026',
  'ug-brakes-foundations',
  'engineering-mechanics-foundation',
  'Reference-only physics background for force, friction, energy conversion, and stopping-distance reasoning. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-university-physics-v1-2026',
  'ug-suspension-steering-foundations',
  'engineering-mechanics-foundation',
  'Reference-only physics background for force, motion, load transfer, and steering/suspension relationships. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-university-physics-v1-2026',
  'ug-aut320-hybrid-vehicle-technology',
  'energy-systems-foundation',
  'Reference-only physics background for energy, power, efficiency, and energy-flow reasoning in electrified vehicle systems. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-university-physics-v1-2026',
  'grad-aut530-advanced-ev-systems',
  'energy-systems-foundation',
  'Reference-only advanced physical-science background for energy, power, efficiency, and system-level EV energy relationships. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-university-physics-v1-2026',
  'grad-aut545-energy-management',
  'energy-systems-foundation',
  'Reference-only physics background for work, power, energy conservation, efficiency, and quantitative energy-flow analysis. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-introduction-computer-science-2026',
  'ug-aut310-network-communications',
  'computing-foundation',
  'Reference-only computing background for data representation, communication, protocols, algorithms, and system reasoning. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-introduction-computer-science-2026',
  'ug-aut370-embedded-systems',
  'computing-foundation',
  'Reference-only computing background for program flow, data representation, hardware-software interaction, and embedded-system reasoning. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-introduction-computer-science-2026',
  'ug-aut380-cybersecurity',
  'computing-foundation',
  'Reference-only computing background for software, data, networks, abstraction, and system boundaries supporting cybersecurity concepts. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-introduction-computer-science-2026',
  'ug-aut390-connected-sdv',
  'computing-foundation',
  'Reference-only computing background for software architecture, data, networking, and algorithmic reasoning in connected and software-defined systems. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-introduction-computer-science-2026',
  'grad-aut550-automotive-networks',
  'computing-foundation',
  'Reference-only computing background for network communication, data representation, protocols, timing concepts, and reliability reasoning. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-introduction-computer-science-2026',
  'grad-aut555-embedded-ecu',
  'computing-foundation',
  'Reference-only computing background for algorithms, program structure, data representation, and hardware-software interaction in embedded control units. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-introduction-computer-science-2026',
  'grad-aut570-cybersecurity',
  'computing-foundation',
  'Reference-only computing background for software, networks, data representation, abstraction, and system boundaries supporting threat-modeling analysis. The source remains noncommercial and is not ingested into AI/RAG.'
),
(
  'openstax-introduction-computer-science-2026',
  'grad-aut575-software-defined-vehicle',
  'computing-foundation',
  'Reference-only computing background for software architecture, algorithms, data structures, networking, and lifecycle reasoning in software-defined vehicle platforms. The source remains noncommercial and is not ingested into AI/RAG.'
)
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;
