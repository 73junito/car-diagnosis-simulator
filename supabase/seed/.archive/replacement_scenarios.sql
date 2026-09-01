delete from scenario_questions where scenario_id = 'electrical-load';

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'electrical-load',
  'During a load test on the charging system while driving, what would indicate an issue with the alternator?',
  'The voltage remains stable at around 13.5V.',
  'The voltage drops below 12V under load.',
  'The voltage increases above 14.5V without any load.',
  'The voltage fluctuates between 12V and 13.5V.',
  'B',
  'A healthy alternator should maintain a steady output of around 13.5V under load, not dropping below 12V which indicates an insufficient charge or potential failure.',
  'intermediate',
  'automotive charging system load testing, alternator output, voltage drop, ground faults, battery condition',
  'A6 Electrical/Electronic Systems'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'electrical-load',
  'What symptom would you expect to observe if there is a poor ground connection in the electrical system?',
  'The headlights will be bright and steady.',
  'The engine will stall frequently.',
  'The radio may have static or intermittent sound.',
  'The alternator belt will make loud noises.',
  'C',
  'A poor ground connection can cause electrical noise, leading to issues like static in the radio. The headlights and engine performance are not directly related to a bad ground.',
  'intermediate',
  'automotive charging system load testing, alternator output, voltage drop, ground faults, battery condition',
  'A6 Electrical/Electronic Systems'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'electrical-load',
  'During a voltmeter check while driving, what reading would suggest a weak or failing battery?',
  '12.5V with the engine off.',
  '13.0V with the engine running at idle.',
  '12.0V with the engine running under load.',
  '14.0V with the engine running at full speed.',
  'C',
  'A battery that is weak or failing will show a lower voltage reading, especially when under load. A healthy battery should maintain around 12.5-13.5V even during moderate loads.',
  'intermediate',
  'automotive charging system load testing, alternator output, voltage drop, ground faults, battery condition',
  'A6 Electrical/Electronic Systems'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'electrical-load',
  'What would you expect to see on a scan tool when the headlights are dim and flickering while driving?',
  'No fault codes related to the charging system.',
  'Fault codes indicating an open circuit in the alternator.',
  'A steady battery voltage reading of 13.5V.',
  'Voltage readings fluctuating between 12V and 14V.',
  'D',
  'Dimming headlights can indicate a charging system issue, often seen as fluctuating voltage readings on the scan tool, suggesting an alternator or battery problem.',
  'intermediate',
  'automotive charging system load testing, alternator output, voltage drop, ground faults, battery condition',
  'A6 Electrical/Electronic Systems'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'electrical-load',
  'Which of the following would be a likely test result when checking for voltage drop in the wiring harness?',
  '12V across all wires.',
  '0V across all wires.',
  'A consistent 13.5V across all wires with no load.',
  'Voltage drops to around 12V on some wires under load.',
  'D',
  'A voltage drop in the wiring harness can be indicative of a poor connection or damaged wire, leading to reduced voltage at certain points during high electrical demand like driving with headlights on.',
  'intermediate',
  'automotive charging system load testing, alternator output, voltage drop, ground faults, battery condition',
  'A6 Electrical/Electronic Systems'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'electrical-load',
  'What would be a plausible reason for dimming headlights while driving?',
  'A malfunctioning headlight bulb.',
  'An overloaded electrical system with multiple accessories running simultaneously.',
  'A properly functioning alternator and battery.',
  'A well-insulated wiring harness.',
  'B',
  'Dimming headlights can be a sign of an overloaded electrical system, where the alternator cannot keep up with the increased load from multiple accessories running at once.',
  'intermediate',
  'automotive charging system load testing, alternator output, voltage drop, ground faults, battery condition',
  'A6 Electrical/Electronic Systems'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'electrical-load',
  'During a visual inspection of the electrical system, what would you be looking for to identify potential issues?',
  'Clean and undamaged wiring harnesses.',
  'Loose or corroded connections at relays and fuses.',
  'A properly sealed battery case with no leaks.',
  'All of the above.',
  'D',
  'A thorough visual inspection should include checking for loose, corroded, or damaged connections as well as ensuring clean wiring and a sealed battery to prevent issues like voltage drops or poor ground connections.',
  'intermediate',
  'automotive charging system load testing, alternator output, voltage drop, ground faults, battery condition',
  'A6 Electrical/Electronic Systems'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'electrical-load',
  'What would be the expected outcome of a battery capacity test if the headlights are dim and flickering?',
  'The battery holds its charge well over 24 hours.',
  'The battery discharges quickly, indicating low capacity or poor condition.',
  'The battery voltage remains stable at 13.5V during a load test.',
  'The battery shows no signs of corrosion on the terminals.',
  'B',
  'A failing battery would show quick discharge, leading to dimming headlights and other electrical issues under load. A healthy battery should maintain its charge and voltage levels during a load test.',
  'intermediate',
  'automotive charging system load testing, alternator output, voltage drop, ground faults, battery condition',
  'A6 Electrical/Electronic Systems'
);
delete from scenario_questions where scenario_id = 'hvac-cooling';

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'hvac-cooling',
  'During a diagnostic check, you notice the compressor clutch is not engaging. What could be the most likely cause?',
  'Low refrigerant charge',
  'Blender door stuck in closed position',
  'Compressor failure',
  'Dirty condenser',
  'C',
  'A non-engaging compressor clutch can indicate a mechanical issue with the compressor itself, such as a failed relay or internal damage.',
  'intermediate',
  'Automotive A/C cooling diagnostics',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'hvac-cooling',
  'You observe that the low-side pressure is abnormally high. What could this indicate?',
  'Excessive refrigerant charge',
  'Compressor malfunction',
  'Condenser blockage',
  'Evaporator freeze-up',
  'A',
  'High low-side pressure can indicate an overcharged system, which could be due to excessive refrigerant.',
  'intermediate',
  'Automotive A/C cooling diagnostics',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'hvac-cooling',
  'During a visual inspection, you notice ice formation on the evaporator core. What is the most probable cause?',
  'Low refrigerant charge',
  'Blender door stuck in closed position',
  'Compressor clutch failure',
  'Evaporator freeze-up due to restricted airflow',
  'D',
  'Ice on the evaporator core is a clear sign of restricted airflow, possibly due to a clogged air filter or blocked ducts.',
  'intermediate',
  'Automotive A/C cooling diagnostics',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'hvac-cooling',
  'You suspect a refrigerant leak. Which of the following would be the most effective method to locate it?',
  'Using a pressure gauge to check for low-side pressure',
  'Inspecting the system visually for obvious leaks',
  'Applying soapy water to suspected areas and observing bubbles',
  'Checking the compressor clutch operation',
  'C',
  'Soapy water can help identify small refrigerant leaks by creating bubbles where the leak is present.',
  'intermediate',
  'Automotive A/C cooling diagnostics',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'hvac-cooling',
  'The high-side pressure reading is significantly lower than normal. What does this suggest?',
  'Excessive refrigerant charge',
  'Compressor failure',
  'Condenser blockage',
  'Low evaporator efficiency',
  'B',
  'A low high-side pressure can indicate a compressor issue, such as a failed compressor or internal damage.',
  'intermediate',
  'Automotive A/C cooling diagnostics',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'hvac-cooling',
  'You find that the condenser is not receiving adequate airflow. What could be causing this?',
  'Blender door stuck in open position',
  'Restricted grille opening',
  'Compressor clutch failure',
  'Low refrigerant charge',
  'B',
  'A blocked or restricted grille can obstruct airflow to the condenser, affecting its performance.',
  'intermediate',
  'Automotive A/C cooling diagnostics',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'hvac-cooling',
  'The air conditioning system is not cooling properly. Upon checking, you find the compressor clutch engages but the blower fan does not operate. What should be your next step?',
  'Check for refrigerant leaks',
  'Inspect the evaporator core for ice',
  'Test the blower relay and fuses',
  'Verify the compressor clutch operation',
  'C',
  'If the compressor clutch is engaging but the fan does not operate, it suggests a problem with the electrical system controlling the blower.',
  'intermediate',
  'Automotive A/C cooling diagnostics',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'hvac-cooling',
  'What is the most reliable method for verifying whether an automotive A/C system contains the manufacturer-specified refrigerant charge?',
  'Recover and weigh the refrigerant using approved A/C service equipment, then compare the recovered amount with the manufacturer’s specification.',
  'Check only the low-side pressure.',
  'Observe compressor-clutch operation.',
  'Check the blend-door position.',
  'A',
  'Operating pressures help assess system performance, but pressures alone cannot establish the exact refrigerant quantity. Recovering and weighing the refrigerant provides the appropriate comparison with the manufacturer-specified charge.',
  'intermediate',
  'Automotive A/C cooling diagnostics',
  'A7 Heating and Air Conditioning'
);
delete from scenario_questions where scenario_id = 'overheating';

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'overheating',
  'During a diagnostic check of the engine''s cooling system, you notice that the coolant temperature gauge reads above normal after driving for about 10 minutes. Which component should be your first point of inspection?',
  'Thermostat',
  'Radiator fan',
  'Water pump',
  'Cooling system hoses',
  'A',
  'The thermostat is a critical component that regulates the flow of coolant through the engine. A stuck closed or partially open thermostat can cause the engine to overheat.',
  'intermediate',
  'cooling system diagnostics, thermostat, radiator airflow, coolant flow, water pump, cooling fan operation',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'overheating',
  'You have just replaced the thermostat in a vehicle with an overheating issue. After driving for 10 minutes, you notice that the engine temperature is still high. What should be your next step?',
  'Check the coolant level',
  'Inspect the water pump operation',
  'Verify radiator airflow',
  'Test the cooling fan',
  'B',
  'If the thermostat is functioning correctly, the next step would be to check the water pump for proper operation as it is essential for coolant circulation.',
  'intermediate',
  'cooling system diagnostics, thermostat, radiator airflow, coolant flow, water pump, cooling fan operation',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'overheating',
  'During a diagnostic check of the engine''s cooling system, you observe that the coolant temperature gauge reads above normal after driving for about 10 minutes. What is the most likely cause if the radiator appears to be functioning properly?',
  'Faulty thermostat',
  'Clogged air filter',
  'Defective water pump',
  'Low coolant level',
  'A',
  'If the radiator is not a factor, the issue could be with the thermostat. A faulty thermostat can prevent proper coolant flow and lead to overheating.',
  'intermediate',
  'cooling system diagnostics, thermostat, radiator airflow, coolant flow, water pump, cooling fan operation',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'overheating',
  'You are performing a diagnostic check on the engine''s cooling system. The coolant temperature gauge reads above normal after 10 minutes of driving. What is the most likely cause if you observe that the water pump is not circulating coolant properly?',
  'Thermostat stuck open',
  'Water pump failure',
  'Coolant level too low',
  'Radiator fan not operating',
  'B',
  'A failing water pump can prevent proper coolant circulation, leading to engine overheating.',
  'intermediate',
  'cooling system diagnostics, thermostat, radiator airflow, coolant flow, water pump, cooling fan operation',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'overheating',
  'During a diagnostic check of the engine''s cooling system, you notice that the coolant temperature gauge reads above normal after driving for about 10 minutes. What is the most likely cause if the radiator fins are dirty or clogged?',
  'Thermostat stuck closed',
  'Radiator airflow issues',
  'Water pump failure',
  'Coolant level too low',
  'B',
  'Dirty radiator fins can restrict air flow, leading to poor heat dissipation and engine overheating.',
  'intermediate',
  'cooling system diagnostics, thermostat, radiator airflow, coolant flow, water pump, cooling fan operation',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'overheating',
  'You are performing a diagnostic check on the engine''s cooling system. The coolant temperature gauge reads above normal after 10 minutes of driving. What is the most likely cause if you observe that the cooling fan does not turn on when it should?',
  'Thermostat stuck open',
  'Cooling fan relay failure',
  'Water pump failure',
  'Low coolant level',
  'B',
  'A faulty cooling fan relay can prevent the fan from operating, leading to poor heat dissipation and engine overheating.',
  'intermediate',
  'cooling system diagnostics, thermostat, radiator airflow, coolant flow, water pump, cooling fan operation',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'overheating',
  'During a diagnostic check of the engine''s cooling system, you notice that the coolant temperature gauge reads above normal after driving for about 10 minutes. What is the most likely cause if the thermostat opens too early or not at all?',
  'Thermostat stuck open',
  'Radiator airflow issues',
  'Water pump failure',
  'Coolant level too low',
  'A',
  'A thermostat that does not function properly can lead to improper coolant flow, causing the engine to overheat.',
  'intermediate',
  'cooling system diagnostics, thermostat, radiator airflow, coolant flow, water pump, cooling fan operation',
  'A7 Heating and Air Conditioning'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'overheating',
  'You are performing a diagnostic check on the engine''s cooling system. The coolant temperature gauge reads above normal after 10 minutes of driving. What is the most likely cause if you observe that the water pump is making unusual noises?',
  'Thermostat stuck open',
  'Cooling fan relay failure',
  'Water pump bearing or impeller issue',
  'Low coolant level',
  'C',
  'A water pump with a bearing or impeller issue can cause unusual noises and poor circulation, leading to engine overheating.',
  'intermediate',
  'cooling system diagnostics, thermostat, radiator airflow, coolant flow, water pump, cooling fan operation',
  'A7 Heating and Air Conditioning'
);
delete from scenario_questions where scenario_id = 'power-loss';

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'power-loss',
  'During a road test, the vehicle struggles to accelerate uphill. A scan tool shows no fault codes related to engine performance. What is the most likely cause of this issue?',
  'Fuel delivery system malfunction (fuel pump or injectors)',
  'Air intake restriction due to a clogged air filter',
  'Exhaust restriction from a partially blocked catalytic converter',
  'Transmission slipping, causing reduced engine load',
  'A',
  'Fuel delivery issues can significantly affect the vehicle''s performance. A malfunctioning fuel pump or injectors could lead to insufficient fuel flow during acceleration, especially under load.',
  'intermediate',
  'engine power loss under load, fuel delivery, air intake restriction, exhaust restriction, transmission slip, sensor diagnostics',
  'A8 Engine Performance'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'power-loss',
  'Upon visual inspection of the engine compartment, you notice a loose vacuum hose connected to the throttle body. What is the most likely immediate effect on the vehicle''s performance?',
  'Increased fuel consumption due to richer air-fuel mixture',
  'Reduced power output due to air intake restriction',
  'Decreased engine temperature leading to poor combustion',
  'Exhaust backpressure causing reduced engine efficiency',
  'B',
  'A loose vacuum hose can cause an air intake restriction, leading to a leaner air-fuel mixture and reduced power output.',
  'intermediate',
  'engine power loss under load, fuel delivery, air intake restriction, exhaust restriction, transmission slip, sensor diagnostics',
  'A8 Engine Performance'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'power-loss',
  'During a diagnostic test, you observe that the manifold absolute pressure (MAP) sensor is reading higher than normal values. What could be causing this issue?',
  'Faulty MAP sensor',
  'Air intake restriction due to a clogged air filter',
  'Exhaust restriction from a partially blocked catalytic converter',
  'Transmission slipping, causing reduced engine load',
  'B',
  'A clogged air filter can restrict the airflow into the engine, leading to higher than normal MAP sensor readings.',
  'intermediate',
  'engine power loss under load, fuel delivery, air intake restriction, exhaust restriction, transmission slip, sensor diagnostics',
  'A8 Engine Performance'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'power-loss',
  'You suspect a potential issue with the throttle position sensor (TPS). Which of the following symptoms would you expect to observe during a road test?',
  'Vehicle accelerates smoothly without any issues',
  'Vehicle struggles to accelerate, especially at low RPMs',
  'Engine idles roughly and stalls frequently',
  'Exhaust emissions are significantly higher than normal',
  'B',
  'A faulty TPS can cause the engine to misinterpret throttle position signals, leading to improper fuel delivery and reduced acceleration.',
  'intermediate',
  'engine power loss under load, fuel delivery, air intake restriction, exhaust restriction, transmission slip, sensor diagnostics',
  'A8 Engine Performance'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'power-loss',
  'During a pressure test of the fuel system, you notice that the fuel pressure is lower than expected. What could be causing this issue?',
  'Faulty fuel pump or regulator',
  'Air intake restriction due to a clogged air filter',
  'Exhaust restriction from a partially blocked catalytic converter',
  'Transmission slipping, causing reduced engine load',
  'A',
  'A malfunctioning fuel pump or regulator can result in lower than normal fuel pressure, affecting the vehicle''s performance during acceleration.',
  'intermediate',
  'engine power loss under load, fuel delivery, air intake restriction, exhaust restriction, transmission slip, sensor diagnostics',
  'A8 Engine Performance'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'power-loss',
  'You perform a visual inspection of the exhaust system and notice that one of the mufflers is loose. What immediate effect could this have on the vehicle''s performance?',
  'Increased fuel consumption due to richer air-fuel mixture',
  'Reduced power output due to air intake restriction',
  'Decreased engine temperature leading to poor combustion',
  'Exhaust backpressure causing reduced engine efficiency',
  'D',
  'A loose muffler can cause exhaust backpressure, reducing the engine''s efficiency and power output.',
  'intermediate',
  'engine power loss under load, fuel delivery, air intake restriction, exhaust restriction, transmission slip, sensor diagnostics',
  'A8 Engine Performance'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'power-loss',
  'During a road test, you notice that the vehicle accelerates poorly but does not show any fault codes. What should be your next step in diagnosing this issue?',
  'Check for transmission fluid level and condition',
  'Inspect the fuel pressure at idle and under load',
  'Listen for unusual noises from the engine compartment',
  'Test the operation of the oxygen sensors',
  'B',
  'Checking the fuel pressure can help determine if there is a fuel delivery issue affecting the vehicle''s performance.',
  'intermediate',
  'engine power loss under load, fuel delivery, air intake restriction, exhaust restriction, transmission slip, sensor diagnostics',
  'A8 Engine Performance'
);

insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  'power-loss',
  'You suspect a potential issue with the mass airflow (MAF) sensor. Which of the following symptoms would you expect to observe during a road test?',
  'Vehicle accelerates smoothly without any issues',
  'Vehicle struggles to accelerate, especially at low RPMs',
  'Engine idles roughly and stalls frequently',
  'Exhaust emissions are significantly higher than normal',
  'B',
  'A faulty MAF sensor can cause the engine to misinterpret airflow signals, leading to improper fuel delivery and reduced acceleration.',
  'intermediate',
  'engine power loss under load, fuel delivery, air intake restriction, exhaust restriction, transmission slip, sensor diagnostics',
  'A8 Engine Performance'
);