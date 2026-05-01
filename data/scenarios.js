// Realistic scenarios for training and assessment
window.scenarios = [
  {
    id: 1,
    symptoms: "Engine will not crank. Clicking sound when key is turned.",
    difficulty: 2,
    primarySystem: 'electrical',
    secondarySystems: ['starter'],
    symptomCategory: 'no-crank',
    trainingFocus: 'battery health, terminal and cable inspection',
    fault: "battery",
    tests: {
      battery: { system: 'electrical', reading: '11.2V', interpretation: 'LOW VOLTAGE' },
      starter: { system: 'electrical', reading: 'Starter relay receives weak power', interpretation: 'WEAK SIGNAL' },
      fuel: { system: 'fuel', reading: 'Not relevant', interpretation: 'NOT APPLICABLE' }
    }
  },
  {
    id: 2,
    symptoms: "Engine cranks but does not start.",
    difficulty: 2,
    primarySystem: 'fuel',
    secondarySystems: ['ignition'],
    symptomCategory: 'no-start',
    trainingFocus: 'fuel pressure and delivery diagnosis',
    fault: "fuel",
    tests: {
      battery: { system: 'electrical', reading: '12.6V', interpretation: 'OK' },
      fuel: { system: 'fuel', reading: '0 PSI (no pressure)', interpretation: 'NO PRESSURE' },
      ignition: { system: 'ignition', reading: 'Spark present at plugs', interpretation: 'OK' }
    }
  },
  {
    id: 3,
    symptoms: "Engine overheats after 10 minutes of driving.",
    difficulty: 3,
    primarySystem: 'cooling',
    secondarySystems: ['engine'],
    symptomCategory: 'overheating',
    trainingFocus: 'cooling system leak and circulation diagnostics',
    fault: "coolant",
    tests: {
      coolant: { system: 'cooling', reading: 'Low level and visible leak', interpretation: 'LEAK / LOW' },
      oil: { system: 'engine', reading: 'Oil normal', interpretation: 'OK' },
      battery: { system: 'electrical', reading: 'Voltage normal', interpretation: 'OK' }
    }
  },
  {
    id: 4,
    symptoms: "Headlights are dim and flicker while driving.",
    difficulty: 3,
    primarySystem: 'electrical',
    secondarySystems: ['battery'],
    symptomCategory: 'electrical-load',
    trainingFocus: 'charging system output and alternator load testing',
    fault: "alternator",
    tests: {
      alternator: { system: 'electrical', reading: 'Output <12V under load', interpretation: 'LOW OUTPUT' },
      battery: { system: 'electrical', reading: 'Partially discharged', interpretation: 'LOW' },
      fuel: { system: 'fuel', reading: 'Unaffected', interpretation: 'NOT APPLICABLE' }
    }
  },
  {
    id: 5,
    symptoms: "Engine misfires under acceleration.",
    difficulty: 3,
    primarySystem: 'ignition',
    secondarySystems: ['fuel'],
    symptomCategory: 'misfire',
    trainingFocus: 'ignition component inspection and spark quality',
    fault: "spark_plugs",
    tests: {
      spark_plugs: { system: 'ignition', reading: 'Heavy carbon buildup', interpretation: 'DEGRADATION' },
      fuel: { system: 'fuel', reading: 'Pressure stable', interpretation: 'OK' },
      battery: { system: 'electrical', reading: 'Voltage normal', interpretation: 'OK' }
    }
  },
  {
    id: 6,
    symptoms: "Car pulls to the right while driving.",
    difficulty: 2,
    primarySystem: 'chassis',
    secondarySystems: ['suspension'],
    symptomCategory: 'steering_alignment',
    trainingFocus: 'wheel alignment and suspension wear diagnostics',
    fault: "alignment",
    tests: {
      alignment: { system: 'chassis', reading: 'Toe/camber out of spec', interpretation: 'MISALIGNMENT' },
      brakes: { system: 'brakes', reading: 'Balanced', interpretation: 'OK' },
      suspension: { system: 'suspension', reading: 'Uneven wear', interpretation: 'WEAR' }
    }
  },
  {
    id: 7,
    symptoms: "Air conditioning not cooling.",
    difficulty: 2,
    primarySystem: 'hvac',
    secondarySystems: ['engine'],
    symptomCategory: 'hvac_cooling',
    trainingFocus: 'refrigerant charge and leak detection',
    fault: "refrigerant",
    tests: {
      refrigerant: { system: 'hvac', reading: 'Low refrigerant', interpretation: 'LOW' },
      battery: { system: 'electrical', reading: 'Stable', interpretation: 'OK' },
      engine: { system: 'engine', reading: 'Normal', interpretation: 'OK' }
    }
  },
  {
    id: 8,
    symptoms: "Engine stalls at idle.",
    difficulty: 3,
    primarySystem: 'air',
    secondarySystems: ['fuel'],
    symptomCategory: 'stalling',
    trainingFocus: 'idle control and airflow diagnosis',
    fault: "idle_valve",
    tests: {
      idle_valve: { system: 'air', reading: 'IAC valve stuck', interpretation: 'STICKY' },
      fuel: { system: 'fuel', reading: 'Delivery normal', interpretation: 'OK' },
      battery: { system: 'electrical', reading: 'Voltage stable', interpretation: 'OK' }
    }
  },
  {
    id: 9,
    symptoms: "Check engine light is on. Code P0300 detected.",
    difficulty: 3,
    primarySystem: 'engine',
    secondarySystems: ['fuel','ignition'],
    symptomCategory: 'misfire',
    trainingFocus: 'DTC interpretation and misfire root cause analysis',
    fault: "misfire",
    tests: {
      misfire: { system: 'engine', reading: 'Random cylinder misfires', interpretation: 'MISFIRE' },
      fuel: { system: 'fuel', reading: 'Injectors partially clogged', interpretation: 'DEGRADATION' },
      battery: { system: 'electrical', reading: 'Voltage OK', interpretation: 'OK' }
    }
  },
  {
    id: 10,
    symptoms: "Vehicle struggles to accelerate uphill.",
    difficulty: 4,
    primarySystem: 'transmission',
    secondarySystems: ['engine'],
    symptomCategory: 'power_loss',
    trainingFocus: 'transmission slip and load performance diagnostics',
    fault: "transmission",
    tests: {
      transmission: { system: 'transmission', reading: 'Slipping under load', interpretation: 'SLIP' },
      engine: { system: 'engine', reading: 'Power normal', interpretation: 'OK' },
      fuel: { system: 'fuel', reading: 'Adequate', interpretation: 'OK' }
    }
  }
  ,
  // New ASE-style procedural scenario (single-fault)
  {
    id: 11,
    symptoms: "Engine will not crank. Starter clicks when key is turned.",
    difficulty: 2,
    primarySystem: 'electrical',
    secondarySystems: ['starter'],
    symptomCategory: 'no-crank',
    trainingFocus: 'battery load testing and terminal integrity',
    // procedural steps (ordered) with expected outcomes for procedure-first evaluation
    steps: [
      { id: 's11-1', label: 'Inspect battery terminals and cables', type: 'inspect', allowedTools: ['visual'], timeCost: 30,
        expectedOutcome: { system: 'electrical', signal: 'corroded_terminals', confidenceImpact: 'medium' }
      },
      { id: 's11-2', label: 'Measure battery voltage (at resting)', type: 'measure', allowedTools: ['voltmeter'], timeCost: 45,
        expectedOutcome: { system: 'electrical', signal: 'low_voltage', confidenceImpact: 'high' }
      },
      { id: 's11-3', label: 'Attempt crank and observe starter behaviour', type: 'action', allowedTools: ['starter_check'], timeCost: 20,
        expectedOutcome: { system: 'electrical', signal: 'clicking_no_turnover', confidenceImpact: 'medium' }
      }
    ],
    faults: [
      { id: 'F11', system: 'electrical', label: 'Dead / low battery' }
    ],
    faultRelationships: [],
    timeLimit: 600
  }

  ,
  // New ASE-style procedural scenario (multi-fault: battery + starter interaction)
  {
    id: 12,
    symptoms: "Engine cranks slowly, intermittent clicking, sometimes fails to start.",
    difficulty: 3,
    primarySystem: 'electrical',
    secondarySystems: ['starter'],
    symptomCategory: 'intermittent_starting',
    trainingFocus: 'differential diagnosis: battery vs starter (current draw & voltage under load)',
    steps: [
      { id: 's12-1', label: 'Visual inspect battery and starter connections', type: 'inspect', allowedTools: ['visual'], timeCost: 30,
        expectedOutcome: { system: 'electrical', signal: 'loose_connections', confidenceImpact: 'medium' }
      },
      { id: 's12-2', label: 'Measure battery voltage under load (while cranking)', type: 'measure', allowedTools: ['voltmeter','clamp_meter'], timeCost: 60,
        expectedOutcome: { system: 'electrical', signal: 'voltage_drop_under_load', confidenceImpact: 'high' }
      },
      { id: 's12-3', label: 'Check starter relay / observe starter engagement', type: 'test', allowedTools: ['multimeter','starter_test'], timeCost: 45,
        expectedOutcome: { system: 'electrical', signal: 'starter_sticking_or_high_draw', confidenceImpact: 'high' }
      },
      { id: 's12-4', label: 'Perform cranking current draw test', type: 'measure', allowedTools: ['clamp_meter'], timeCost: 60,
        expectedOutcome: { system: 'electrical', signal: 'high_current_draw', confidenceImpact: 'high' }
      }
    ],
    faults: [
      { id: 'F12', system: 'electrical', label: 'Weak / discharged battery' },
      { id: 'F13', system: 'electrical', label: 'Sticking starter / starter motor fault' }
    ],
    // relationship: symptom overlap and masking (battery issues can mask starter faults)
    faultRelationships: [
      { faultIds: ['F12','F13'], interaction: 'symptom_overlap' }
    ],
    timeLimit: 900
  }
];

