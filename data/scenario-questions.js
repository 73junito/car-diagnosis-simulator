window.SCENARIO_QUESTIONS = {
  "hybrid-ev": [
    {
      question_text: "What is the first step before performing high-voltage insulation testing?",
      option_a: "Disconnect the 12V battery",
      option_b: "Perform a visual inspection and ensure the vehicle is powered on",
      option_c: "Put on appropriate PPE and follow safety procedures",
      option_d: "Start the engine and monitor live data",
      correct_answer: "C",
      explanation: "High-voltage systems require PPE and lockout/tagout safety procedures before testing.",
      difficulty: "advanced",
      topic: "High-voltage safety"
    }
  ],
  "hybrid-ev-17": [
    {
      question_text: "What does low insulation resistance usually indicate in a hybrid/EV system?",
      option_a: "Normal inverter operation",
      option_b: "A possible high-voltage isolation fault",
      option_c: "A low 12V battery only",
      option_d: "A fuel trim issue",
      correct_answer: "B",
      explanation: "Low insulation resistance points to a possible HV isolation or insulation fault.",
      difficulty: "advanced",
      topic: "HV insulation testing"
    }
  ],
  "charging-system": [
    {
      question_text: "What should be checked first when the battery drains while driving?",
      option_a: "Alternator output and charging voltage",
      option_b: "Tire pressure",
      option_c: "Coolant level",
      option_d: "Fuel pressure",
      correct_answer: "A",
      explanation: "A battery warning lamp and battery drain while driving point toward charging system testing.",
      difficulty: "intermediate",
      topic: "Charging system"
    }
  ]
,
  "no-crank": [
    {
      question_text: "What is the first test when an engine will not crank and only clicks?",
      option_a: "Check battery voltage and connections",
      option_b: "Replace the starter immediately",
      option_c: "Check fuel pressure",
      option_d: "Inspect spark plugs",
      correct_answer: "A",
      explanation: "A clicking sound during cranking commonly indicates low battery voltage or poor cable connections.",
      difficulty: "beginner",
      topic: "Battery testing"
    },
    {
      question_text: "What battery voltage is expected on a fully charged battery at rest?",
      option_a: "9.6V",
      option_b: "10.5V",
      option_c: "12.6V",
      option_d: "14.8V",
      correct_answer: "C",
      explanation: "A healthy fully charged lead-acid battery should measure approximately 12.6 volts.",
      difficulty: "beginner",
      topic: "Battery state of charge"
    }
    ,
    {
      question_text: "When performing a battery load test, which result indicates the battery needs replacement?",
      option_a: "Voltage stays above 12.4V under load",
      option_b: "Voltage drops below 9.6V under a rated load",
      option_c: "Voltage remains at 12.6V under load",
      option_d: "Battery accepts full charge quickly",
      correct_answer: "B",
      explanation: "A voltage below about 9.6V under a rated load typically indicates a failing battery that should be replaced.",
      difficulty: "intermediate",
      topic: "Battery load testing"
    },
    {
      question_text: "What is the purpose of a voltage-drop test on the starter circuit?",
      option_a: "To measure fuel pressure during cranking",
      option_b: "To verify excessive resistance in wiring or connections",
      option_c: "To check ignition timing",
      option_d: "To test alternator diodes",
      correct_answer: "B",
      explanation: "Voltage-drop testing helps identify high resistance in cables, terminals, or connections that can prevent adequate starter current.",
      difficulty: "intermediate",
      topic: "Voltage-drop testing"
    },
    {
      question_text: "Which terminal condition commonly causes poor starter performance?",
      option_a: "Freshly painted terminals",
      option_b: "Clean, tight clamps",
      option_c: "Heavy corrosion and loose clamps",
      option_d: "Short battery cable length",
      correct_answer: "C",
      explanation: "Corrosion and loose clamps increase resistance and can prevent sufficient current from reaching the starter.",
      difficulty: "beginner",
      topic: "Terminal corrosion"
    },
    {
      question_text: "High ground-path resistance can cause which symptom?",
      option_a: "Excessive engine rpm",
      option_b: "No-start or slow cranking despite good battery voltage",
      option_c: "Overheating coolant",
      option_d: "High oil pressure",
      correct_answer: "B",
      explanation: "A poor ground path raises circuit resistance and may lead to slow or no cranking even if battery voltage appears acceptable.",
      difficulty: "intermediate",
      topic: "Ground path"
    },
    {
      question_text: "What should be checked to verify starter relay operation?",
      option_a: "Fuel injector pulse",
      option_b: "Continuity and control voltage at the relay coil while attempting to crank",
      option_c: "Wheel bearing play",
      option_d: "Coolant temperature",
      correct_answer: "B",
      explanation: "Checking for control voltage at the relay coil and continuity through relay contacts confirms relay operation.",
      difficulty: "intermediate",
      topic: "Starter relay"
    },
    {
      question_text: "Measuring solenoid control voltage at the starter while cranking should show what?",
      option_a: "No voltage ever",
      option_b: "Intermittent pulses only when hot",
      option_c: "A near-battery voltage signal when the key is engaged to start",
      option_d: "Negative voltage",
      correct_answer: "C",
      explanation: "The solenoid should receive a near-battery voltage control signal when the starter is commanded, indicating the circuit from ignition switch/relay is functioning.",
      difficulty: "intermediate",
      topic: "Solenoid control"
    },
    {
      question_text: "A missing ignition-switch start signal can be caused by which of the following?",
      option_a: "A fully charged battery",
      option_b: "Worn key cylinder or faulty ignition switch contacts",
      option_c: "Proper ground connection",
      option_d: "Correct fuel pressure",
      correct_answer: "B",
      explanation: "Mechanical wear or internal switch contact failure can prevent the ignition switch from sending a start signal to the starter circuit.",
      difficulty: "intermediate",
      topic: "Ignition switch"
    },
    {
      question_text: "Why should the park/neutral safety switch be inspected for vehicles that won't crank?",
      option_a: "It controls fuel mixture",
      option_b: "If open it prevents starter engagement for safety",
      option_c: "It adjusts ignition timing",
      option_d: "It measures battery capacity",
      correct_answer: "B",
      explanation: "The park/neutral safety switch prevents cranking when the transmission is not in Park or Neutral; a failed switch can block starter activation.",
      difficulty: "beginner",
      topic: "Safety interlocks"
    },
    {
      question_text: "On manual-transmission vehicles, what device can prevent the engine from cranking?",
      option_a: "Clutch interlock switch if faulty",
      option_b: "Cruise control module",
      option_c: "Alternator pulley",
      option_d: "Mass airflow sensor",
      correct_answer: "A",
      explanation: "A faulty clutch interlock switch can interrupt the starter circuit and prevent cranking until the switch is working correctly.",
      difficulty: "beginner",
      topic: "Clutch interlock"
    },
    {
      question_text: "Starter current draw testing helps diagnose what condition?",
      option_a: "Excessive starter engagement resistance or a seized engine",
      option_b: "Brake fluid level",
      option_c: "Spark plug gap",
      option_d: "Transmission fluid color",
      correct_answer: "A",
      explanation: "High or low starter current draw compared to specifications indicates internal starter problems or mechanical engine seizure.",
      difficulty: "intermediate",
      topic: "Starter current draw"
    },
    {
      question_text: "What is a quick check to help verify the engine is not seized?",
      option_a: "Attempt to rotate engine with starter while monitoring current draw",
      option_b: "Check cabin temperature",
      option_c: "Replace battery",
      option_d: "Disconnect the alternator",
      correct_answer: "A",
      explanation: "Observing starter current and whether the crankshaft can be rotated helps determine if the engine is mechanically seized.",
      difficulty: "intermediate",
      topic: "Seized engine"
    },
    {
      question_text: "A scan tool shows no start authorization; what system is likely preventing crank?",
      option_a: "Immobilizer/security system",
      option_b: "ABS",
      option_c: "HVAC",
      option_d: "Tire pressure monitor",
      correct_answer: "A",
      explanation: "Modern immobilizer or security systems can disable starter authorization and must be checked with a scan tool or security diagnostics.",
      difficulty: "intermediate",
      topic: "Immobilizer"
    },
    {
      question_text: "Why is interpreting wiring diagrams important when diagnosing no-crank issues?",
      option_a: "To color-match paint",
      option_b: "To identify correct power and ground paths and component interconnections",
      option_c: "To measure tire wear",
      option_d: "To set radio presets",
      correct_answer: "B",
      explanation: "Wiring diagrams help locate connectors, fuses, relays, and paths to test for continuity and voltage in the starter circuit.",
      difficulty: "intermediate",
      topic: "Wiring diagrams"
    },
    {
      question_text: "Which PID or data parameter is useful as a starter command confirmation on vehicles with serial data?",
      option_a: "Engine oil temperature",
      option_b: "Starter command or starter motor enable PID",
      option_c: "Ambient temperature",
      option_d: "Fuel level",
      correct_answer: "B",
      explanation: "A starter command PID indicates whether the vehicle's control module is issuing a starter enable signal over the bus when the key is turned.",
      difficulty: "intermediate",
      topic: "Scan tool data"
    },
    {
      question_text: "What should you inspect on battery and starter cables?",
      option_a: "Only the outer insulation color",
      option_b: "Cable condition, corrosion, secure clamps, and any broken strands",
      option_c: "The radio antenna connection",
      option_d: "Brake pad thickness",
      correct_answer: "B",
      explanation: "Cable integrity and clamp security are critical for low resistance; frayed or corroded cables cause starting issues.",
      difficulty: "beginner",
      topic: "Cable inspection"
    },
    {
      question_text: "Why should you avoid bypassing relays or fusing paths during diagnosis without caution?",
      option_a: "It might speed up diagnosis safely",
      option_b: "It can cause damage, create unsafe conditions, or bypass safety interlocks",
      option_c: "It will always fix the problem permanently",
      option_d: "It saves time on repairs",
      correct_answer: "B",
      explanation: "Bypassing circuits can disable safety features and may cause damage; always follow safe bypass procedures and manufacturer guidance.",
      difficulty: "intermediate",
      topic: "Relay bypass"
    },
    {
      question_text: "What is an appropriate post-repair verification step after fixing a no-crank condition?",
      option_a: "Verify starter function, perform a cranking test, and confirm no diagnostic trouble codes remain",
      option_b: "Only wash the vehicle",
      option_c: "Change unrelated fluids",
      option_d: "Reset radio presets",
      correct_answer: "A",
      explanation: "After repair, perform function checks, cranking tests, and scan for any stored faults to ensure the issue is resolved.",
      difficulty: "beginner",
      topic: "Post-repair verification"
    }
    ,
    {
      question_text: "Mechanical starter engagement failures are most often caused by which condition?",
      option_a: "Worn pinion teeth or a failed drive engagement mechanism",
      option_b: "Overinflated tires",
      option_c: "Low windshield washer fluid",
      option_d: "Faulty cabin air filter",
      correct_answer: "A",
      explanation: "Mechanical engagement failures are typically caused by worn or damaged starter pinion teeth or a failed engagement mechanism preventing proper mesh with the flywheel.",
      difficulty: "intermediate",
      topic: "Mechanical starter engagement"
    }
  ]
};
