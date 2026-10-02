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
      id: "no-crank-battery-check-01",
      status: "draft",
      question_text: "For a click/no-crank complaint, which is an appropriate initial diagnostic check before condemning the starter?",
      option_a: "Check battery voltage and connections",
      option_b: "Replace the starter immediately",
      option_c: "Check fuel pressure",
      option_d: "Inspect spark plugs",
      correct_answer: "A",
      explanation: "Battery condition and cable/terminal integrity should be checked early because insufficient available voltage or excessive circuit resistance can produce a click/no-crank symptom.",
      difficulty: "beginner",
      topic: "Battery testing",
      sources: []
    },
    {
      id: "no-crank-battery-voltage-01",
      status: "draft",
      question_text: "For a conventional 12 V lead-acid battery that has rested with surface charge removed, which open-circuit voltage is commonly associated with a fully charged battery?",
      option_a: "9.6V",
      option_b: "10.5V",
      option_c: "12.6V",
      option_d: "14.8V",
      correct_answer: "C",
      explanation: "Approximately 12.6 V is a common reference for a rested, fully charged conventional 12 V lead-acid battery; battery type, temperature, and service information must still be considered.",
      difficulty: "beginner",
      topic: "Battery state of charge",
      sources: []
    }
    ,
    {
      id: "no-crank-battery-load-01",
      status: "draft",
      question_text: "During a carbon-pile load test at one-half the battery's CCA rating for 15 seconds, with the battery at about 70°F (21°C), which result is below the commonly specified minimum for a conventional 12 V lead-acid battery?",
      option_a: "Voltage stays above 12.4V under load",
      option_b: "Voltage drops below 9.6 V while the specified load is applied",
      option_c: "Voltage remains at 12.6V under load",
      option_d: "Battery accepts full charge quickly",
      correct_answer: "B",
      explanation: "For the stated 15-second test at about 70°F (21°C), 9.6 V is a commonly published minimum; other temperatures, battery types, and test equipment require their applicable specifications.",
      difficulty: "intermediate",
      topic: "Battery load testing",
      sources: []
    },
    {
      id: "no-crank-voltage-drop-01",
      status: "draft",
      question_text: "What is the purpose of a voltage-drop test on the starter circuit?",
      option_a: "To measure fuel pressure during cranking",
      option_b: "To verify excessive resistance in wiring or connections",
      option_c: "To check ignition timing",
      option_d: "To test alternator diodes",
      correct_answer: "B",
      explanation: "Voltage-drop testing helps identify high resistance in cables, terminals, or connections that can prevent adequate starter current.",
      difficulty: "intermediate",
      topic: "Voltage-drop testing",
      sources: []
    },
    {
      id: "no-crank-terminal-corrosion-01",
      status: "draft",
      question_text: "Which terminal condition commonly causes poor starter performance?",
      option_a: "Freshly painted terminals",
      option_b: "Clean, tight clamps",
      option_c: "Heavy corrosion and loose clamps",
      option_d: "Short battery cable length",
      correct_answer: "C",
      explanation: "Corrosion and loose clamps increase resistance and can prevent sufficient current from reaching the starter.",
      difficulty: "beginner",
      topic: "Terminal corrosion",
      sources: []
    },
    {
      id: "no-crank-ground-resistance-01",
      status: "draft",
      question_text: "What cranking symptom can excessive resistance in the starter ground path produce even when battery open-circuit voltage appears acceptable?",
      option_a: "Excessive engine rpm",
      option_b: "Slow cranking or no crank",
      option_c: "Overheating coolant",
      option_d: "High oil pressure",
      correct_answer: "B",
      explanation: "Excessive resistance in the starter ground path can create voltage loss under load and cause slow cranking or no crank even when open-circuit battery voltage appears acceptable.",
      difficulty: "intermediate",
      topic: "Ground path",
      sources: []
    },
    {
      id: "no-crank-starter-relay-01",
      status: "draft",
      question_text: "Which check is appropriate when verifying a starter relay in an energized starting circuit?",
      option_a: "Fuel injector pulse",
      option_b: "Verify the relay command and check voltage at the relay output or voltage drop according to the wiring diagram",
      option_c: "Wheel bearing play",
      option_d: "Coolant temperature",
      correct_answer: "B",
      explanation: "An energized starting circuit should be evaluated with voltage-based checks and the correct wiring diagram; resistance/continuity measurements are performed only with the circuit de-energized as specified.",
      difficulty: "intermediate",
      topic: "Starter relay",
      sources: []
    },
    {
      id: "no-crank-solenoid-voltage-01",
      status: "draft",
      question_text: "When checking the starter-solenoid control circuit during a crank request, how should the measured control voltage be evaluated?",
      option_a: "No voltage ever",
      option_b: "Intermittent pulses only when hot",
      option_c: "Compare the loaded control voltage with the applicable wiring diagram and OEM or component specification",
      option_d: "Negative voltage",
      correct_answer: "C",
      explanation: "Starter control-circuit thresholds vary by design, so the measured voltage should be interpreted against the applicable service information rather than a universal pass/fail value.",
      difficulty: "intermediate",
      topic: "Solenoid control",
      sources: []
    },
    {
      id: "no-crank-ignition-switch-01",
      status: "draft",
      question_text: "A missing start-request signal in a no-crank condition can be caused by which type of fault?",
      option_a: "A fully charged battery",
      option_b: "A fault in the start-command input, switch/module logic, wiring, or related connection",
      option_c: "Proper ground connection",
      option_d: "Correct fuel pressure",
      correct_answer: "B",
      explanation: "Depending on vehicle design, the start request may pass through a switch, input, module, network, relay, and wiring path; faults in that path can prevent starter authorization.",
      difficulty: "intermediate",
      topic: "Ignition switch",
      sources: []
    },
    {
      id: "no-crank-park-neutral-01",
      status: "draft",
      question_text: "Why should a park/neutral switch or transmission-range input be checked on an automatic-transmission vehicle with a no-crank complaint?",
      option_a: "It controls fuel mixture",
      option_b: "A faulty or incorrect range signal can prevent starter authorization",
      option_c: "It adjusts ignition timing",
      option_d: "It measures battery capacity",
      correct_answer: "B",
      explanation: "Vehicles commonly require a valid Park or Neutral range input before starter authorization; the exact device and logic depend on vehicle design.",
      difficulty: "beginner",
      topic: "Safety interlocks",
      sources: []
    },
    {
      id: "no-crank-clutch-interlock-01",
      status: "draft",
      question_text: "On a manual-transmission vehicle equipped with a clutch-start interlock, which fault can prevent cranking?",
      option_a: "A faulty or misadjusted clutch-start/interlock switch",
      option_b: "Cruise control module",
      option_c: "Alternator pulley",
      option_d: "Mass airflow sensor",
      correct_answer: "A",
      explanation: "On vehicles that use a clutch-start interlock, an incorrect clutch-pedal input can prevent the starter-enable path from being completed.",
      difficulty: "beginner",
      topic: "Clutch interlock",
      sources: []
    },
    {
      id: "no-crank-starter-current-01",
      status: "draft",
      question_text: "When evaluating starter-system performance, why should starter current be interpreted together with battery voltage drop and battery condition rather than used by itself?",
      option_a: "Because starting performance depends on interacting factors such as voltage drop, battery condition, internal resistance, and cold-cranking capability",
      option_b: "Because starter current determines brake-fluid condition",
      option_c: "Because starter current sets spark-plug gap",
      option_d: "Because starter current identifies transmission-fluid color",
      correct_answer: "A",
      explanation: "A starter draws high current during cranking, while starting performance is also affected by battery voltage drop, battery condition, internal resistance, and CCA. Current therefore should be interpreted with those related measurements and conditions rather than as an isolated result.",
      difficulty: "intermediate",
      topic: "Starter current draw",
      sources: []
    },
    {
      id: "no-crank-seized-engine-01",
      status: "draft",
      question_text: "Before condemning the starter for a no-crank condition, how should possible engine mechanical lockup be verified?",
      option_a: "Use the manufacturer-approved mechanical inspection or crankshaft-rotation procedure with the vehicle safely disabled",
      option_b: "Check cabin temperature",
      option_c: "Replace battery",
      option_d: "Disconnect the alternator",
      correct_answer: "A",
      explanation: "A suspected mechanical lockup should be checked with an approved mechanical procedure and appropriate safety precautions rather than repeatedly energizing the starter.",
      difficulty: "intermediate",
      topic: "Seized engine",
      sources: []
    },
    {
      id: "no-crank-immobilizer-01",
      status: "draft",
      question_text: "A scan tool indicates that starter authorization is denied. Which system should be investigated as a possible cause, depending on vehicle design?",
      option_a: "Immobilizer/security system",
      option_b: "ABS",
      option_c: "HVAC",
      option_d: "Tire pressure monitor",
      correct_answer: "A",
      explanation: "Security or immobilizer logic can inhibit starter authorization on some vehicles, while other designs may allow cranking and inhibit fuel or ignition; service information is required.",
      difficulty: "intermediate",
      topic: "Immobilizer",
      sources: []
    },
    {
      id: "no-crank-wiring-diagram-01",
      status: "draft",
      question_text: "Why is interpreting wiring diagrams important when diagnosing no-crank issues?",
      option_a: "To color-match paint",
      option_b: "To identify correct power and ground paths and component interconnections",
      option_c: "To measure tire wear",
      option_d: "To set radio presets",
      correct_answer: "B",
      explanation: "Wiring diagrams help locate connectors, fuses, relays, and paths to test for continuity and voltage in the starter circuit.",
      difficulty: "intermediate",
      topic: "Wiring diagrams",
      sources: []
    },
    {
      id: "no-crank-starter-pid-01",
      status: "draft",
      question_text: "When supported by the vehicle, which scan-tool data item can help confirm that a module is requesting or authorizing starter operation?",
      option_a: "Engine oil temperature",
      option_b: "A starter command, crank request, or starter-enable parameter identified in service information",
      option_c: "Ambient temperature",
      option_d: "Fuel level",
      correct_answer: "B",
      explanation: "Supported scan data can help separate a command/authorization problem from a downstream starter-circuit problem, but PID names and availability vary by manufacturer and model.",
      difficulty: "intermediate",
      topic: "Scan tool data",
      sources: []
    },
    {
      id: "no-crank-cable-inspect-01",
      status: "draft",
      question_text: "What should you inspect on battery and starter cables?",
      option_a: "Only the outer insulation color",
      option_b: "Cable condition, corrosion, secure clamps, and any broken strands",
      option_c: "The radio antenna connection",
      option_d: "Brake pad thickness",
      correct_answer: "B",
      explanation: "Cable integrity and clamp security are critical for low resistance; frayed or corroded cables cause starting issues.",
      difficulty: "beginner",
      topic: "Cable inspection",
      sources: []
    },
    {
      id: "no-crank-relay-bypass-01",
      status: "draft",
      question_text: "Why should starter relays, fuses, or safety interlocks not be bypassed with improvised jumpers during diagnosis?",
      option_a: "It is the preferred diagnostic method on all vehicles",
      option_b: "It can cause damage, create unsafe conditions, or bypass safety interlocks",
      option_c: "It will always fix the problem permanently",
      option_d: "It saves time on repairs",
      correct_answer: "B",
      explanation: "Improvised bypassing can defeat safety interlocks or circuit protection and can damage components. Use manufacturer-approved diagnostic procedures and test methods.",
      difficulty: "intermediate",
      topic: "Relay bypass",
      sources: []
    },
    {
      id: "no-crank-post-repair-01",
      status: "draft",
      question_text: "What is an appropriate post-repair verification after correcting a no-crank condition?",
      option_a: "Verify the original symptom is corrected, repeat the relevant cranking/electrical checks, and address related faults according to service information",
      option_b: "Only wash the vehicle",
      option_c: "Change unrelated fluids",
      option_d: "Reset radio presets",
      correct_answer: "A",
      explanation: "Post-repair verification should reproduce the relevant operating conditions, confirm normal starter operation, repeat the tests that identified the fault, and handle related diagnostic codes according to the service procedure.",
      difficulty: "beginner",
      topic: "Post-repair verification",
      sources: []
    }
    ,
    {
      id: "no-crank-mechanical-engagement-01",
      status: "draft",
      question_text: "Which condition can cause a starter to spin or operate without properly turning the engine?",
      option_a: "A fault in the starter drive/pinion engagement or damaged ring-gear teeth",
      option_b: "Overinflated tires",
      option_c: "Low windshield washer fluid",
      option_d: "Faulty cabin air filter",
      correct_answer: "A",
      explanation: "Starter drive, pinion, or ring-gear faults can prevent proper mechanical engagement. Inspection should follow the applicable starter and vehicle service procedure.",
      difficulty: "intermediate",
      topic: "Mechanical starter engagement",
      sources: []
    }
  ]
};

// Approved sources registry. Questions should reference entries here by `source_id`.
window.APPROVED_SOURCES = {
  // Example entry (do not include placeholder page numbers):
  // "ase-a6-approved-edition": {
  //   title: "ASE Automobile Study Guide: A6 Electrical/Electronic Systems",
  //   publisher: "ASE Education Foundation",
  //   edition: "APPROVED_EDITION",
  //   publication_year: 2024,
  //   status: "approved",
  //   checksum: "",
  //   license_status: "authorized"
  // }
};
