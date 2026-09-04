// Realistic scenarios for training and assessment

// Centralized category registry (attached to window for non-module environments)
const SCENARIO_CATEGORIES = [
  'no-crank',
  'no-start',
  'overheating',
  'electrical-load',
  'misfire',
  'steering-alignment',
  'hvac-cooling',
  'stalling',
  'power-loss',
  'intermittent-starting',
  // recommended expansions (examples)
  'charging-system',
  'battery-drain',
  'fuel-delivery',
  'sensor-failure',
  'can-bus-network',
  'abs-brake-system',
  'transmission-shift',
  'hybrid-ev',
  'diesel-aftertreatment',
  'air-conditioning-electrical',
  'cooling-fan-control',
  'starting-voltage-drop',
  'ground-fault',
  'parasitic-draw',
  'turbo-underboost',
  'emissions-evap',
  'adas-calibration',
  'high-voltage-safety',
  'network-security',
  'data-stream-analysis'
];
window.SCENARIO_CATEGORIES = SCENARIO_CATEGORIES;

// Default metadata applied to scenarios (keeps existing numeric `difficulty` intact)

const DEFAULT_SCENARIO_METADATA = {
  vehicleType: 'gasoline',
  diagnosticMode: 'basic',
  requiredTools: ['DVOM', 'Scan Tool'],
  safetyLevel: 'normal',
  difficultyLevel: 'intermediate',
  // scenario metadata defaults for versioning and scoring
  schemaVersion: '1.2',
  scoringWeights: {
    diagnosticAccuracy: 40,
    proceduralCorrectness: 25,
    safetyCompliance: 20,
    toolEfficiency: 15
  }
};

// Validate and normalize scenario metadata in-place
function validateScenarioMetadata(s) {
  if (!s) return;
  // ensure schema version and scoring weights exist
  if (s.schemaVersion === undefined) s.schemaVersion = DEFAULT_SCENARIO_METADATA.schemaVersion;
  if (s.scoringWeights === undefined || typeof s.scoringWeights !== 'object') s.scoringWeights = Object.assign({}, DEFAULT_SCENARIO_METADATA.scoringWeights);
  if (s.aseArea === undefined && DEFAULT_SCENARIO_METADATA.aseArea) s.aseArea = DEFAULT_SCENARIO_METADATA.aseArea;
  if (s.vehicleType === undefined && DEFAULT_SCENARIO_METADATA.vehicleType) s.vehicleType = DEFAULT_SCENARIO_METADATA.vehicleType;
  if (s.faultType === undefined && DEFAULT_SCENARIO_METADATA.faultType) s.faultType = DEFAULT_SCENARIO_METADATA.faultType;
  if (s.diagnosticMode === undefined && DEFAULT_SCENARIO_METADATA.diagnosticMode) s.diagnosticMode = DEFAULT_SCENARIO_METADATA.diagnosticMode;
  if (!Array.isArray(s.requiredTools)) s.requiredTools = DEFAULT_SCENARIO_METADATA.requiredTools.slice();
  if (s.safetyLevel === undefined && DEFAULT_SCENARIO_METADATA.safetyLevel) s.safetyLevel = DEFAULT_SCENARIO_METADATA.safetyLevel;
  // for high-voltage scenarios, require an explicit safety acknowledgement
  if (s.requiresSafetyAcknowledgment === undefined) {
    s.requiresSafetyAcknowledgment = (s.safetyLevel === 'high-voltage');
  }
  if (!s.difficultyLevel) {
    if (typeof s.difficulty === 'number') {
      s.difficultyLevel = s.difficulty >= 4 ? 'advanced' : (s.difficulty >= 3 ? 'intermediate' : 'beginner');
    } else {
      s.difficultyLevel = DEFAULT_SCENARIO_METADATA.difficultyLevel;
    }
  }
  if (s.symptomCategory && !SCENARIO_CATEGORIES.includes(s.symptomCategory)) {
    // keep category but add to registry for discoverability
    SCENARIO_CATEGORIES.push(s.symptomCategory);
  }
}

// Normalize and validate scoring weights; ensure total equals 100
function normalizeScoringWeights(weights) {
  if (!weights || typeof weights !== 'object') return Object.assign({}, DEFAULT_SCENARIO_METADATA.scoringWeights);
  const vals = Object.values(weights).map(v => Number(v) || 0);
  const total = vals.reduce((a, b) => a + b, 0);
  if (total !== 100) {
    throw new Error(`scoringWeights must total 100 (got ${total})`);
  }
  return weights;
}

// Expose defaults for debugging / external scripts
window.DEFAULT_SCENARIO_METADATA = DEFAULT_SCENARIO_METADATA;

window.scenarios = [
  {
    id: 1,
    scenario_key: 'no-crank-clicking',
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
    scenario_key: 'no-start',
    symptoms: "Engine cranks but does not start.",
    difficulty: 2,
    primarySystem: 'fuel',
    secondarySystems: ['ignition'],
    symptomCategory: 'no-start',
    aseArea: 'A8',
    vehicleType: 'gasoline',
    faultType: 'hard-fault',
    diagnosticMode: 'scan-tool',
    requiredTools: ['Fuel Pressure Gauge','Scan Tool','DVOM'],
    safetyLevel: 'normal',
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
    scenario_key: 'overheating',
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
    scenario_key: 'electrical-load',
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
    scenario_key: 'misfire-acceleration',
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
    scenario_key: 'steering-alignment',
    symptoms: "Car pulls to the right while driving.",
    difficulty: 2,
    primarySystem: 'chassis',
    secondarySystems: ['suspension'],
    symptomCategory: 'steering-alignment',
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
    scenario_key: 'hvac-cooling',
    symptoms: "Air conditioning not cooling.",
    difficulty: 2,
    primarySystem: 'hvac',
    secondarySystems: ['engine'],
    symptomCategory: 'hvac-cooling',
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
    scenario_key: 'stalling',
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
    scenario_key: 'misfire-p0300',
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
    scenario_key: 'power-loss',
    symptoms: "Vehicle struggles to accelerate uphill.",
    difficulty: 4,
    primarySystem: 'transmission',
    secondarySystems: ['engine'],
    symptomCategory: 'power-loss',
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
    scenario_key: 'no-crank-starter-click',
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
    // provide compatibility for AJV schema: include 'fault' and 'tests' placeholders
    fault: 'battery',
    tests: {
      battery: { system: 'electrical', reading: '11.2V', interpretation: 'LOW VOLTAGE' }
    },
    faultRelationships: [],
    timeLimit: 600
  }

  ,
  // New ASE-style procedural scenario (multi-fault: battery + starter interaction)
  {
    id: 12,
    scenario_key: 'intermittent-starting',
    symptoms: "Engine cranks slowly, intermittent clicking, sometimes fails to start.",
    difficulty: 3,
    primarySystem: 'electrical',
    secondarySystems: ['starter'],
    symptomCategory: 'intermittent-starting',
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
    fault: 'battery_or_starter',
    tests: {
      battery: { system: 'electrical', reading: '12.0V under load', interpretation: 'LOW_UNDER_LOAD' },
      starter: { system: 'electrical', reading: 'High current draw', interpretation: 'HIGH_DRAW' }
    },
    // relationship: symptom overlap and masking (battery issues can mask starter faults)
    faultRelationships: [
      { faultIds: ['F12','F13'], interaction: 'symptom_overlap' }
    ],
    timeLimit: 900
  }
  ,
  // Example: charging system (ASE A6)
  {
    id: 13,
    scenario_key: 'charging-system',
    symptoms: "Battery drains while driving, warning lamp for charging appears.",
    difficulty: 3,
    primarySystem: 'electrical',
    secondarySystems: ['charging','battery'],
    symptomCategory: 'charging-system',
    aseArea: 'A6',
    vehicleType: 'gasoline',
    faultType: 'electrical',
    diagnosticMode: 'waveform-analysis',
    requiredTools: ['DVOM','Oscilloscope','Charge Load Tester'],
    safetyLevel: 'normal',
    trainingFocus: 'alternator output and charging regulation',
    fault: 'alternator',
    tests: {
      alternator: { system: 'electrical', reading: 'Output <12V under load', interpretation: 'LOW OUTPUT' },
      battery: { system: 'electrical', reading: 'Partially discharged', interpretation: 'LOW' }
    }
  },
  // Example: CAN bus network issue
  {
    id: 14,
    scenario_key: 'can-bus-network',
    symptoms: "Intermittent module communication errors; multiple U-codes present.",
    difficulty: 4,
    primarySystem: 'network',
    secondarySystems: ['power','modules'],
    symptomCategory: 'can-bus-network',
    aseArea: 'A6',
    vehicleType: 'gasoline',
    faultType: 'network',
    diagnosticMode: 'scan-tool',
    requiredTools: ['Scan Tool','Oscilloscope','CAN BUS Analyzer'],
    safetyLevel: 'normal',
    trainingFocus: 'CAN bus isolation and module communication',
    fault: 'open_bus_segment',
    tests: {
      bus: { system: 'network', reading: 'No ACK on CAN ID 0x7E0', interpretation: 'BUS_FAULT' },
      module: { system: 'electrical', reading: 'Module asleep/unresponsive', interpretation: 'SLEEP/NO_COMM' }
    }
  },
  // Example: hybrid / EV safety-related scenario
  {
    id: 15,
    scenario_key: 'hybrid-ev-isolation',
    symptoms: "Hybrid system disables on startup; HV battery isolation fault logged.",
    difficulty: 5,
    primarySystem: 'hybrid',
    secondarySystems: ['inverter','battery'],
    symptomCategory: 'hybrid-ev',
    aseArea: 'A6',
    vehicleType: 'hybrid',
    faultType: 'electrical',
    diagnosticMode: 'guided-diagnostics',
    requiredTools: ['HV Insulation Tester','Scan Tool','PPE'],
    safetyLevel: 'high-voltage',
    trainingFocus: 'HV isolation, inverter readiness, safety protocols',
    fault: 'hv_isolation_fault',
    tests: {
      hv: { system: 'hybrid', reading: 'Insulation resistance low', interpretation: 'FAIL' },
      inverter: { system: 'hybrid', reading: 'Inverter disabled', interpretation: 'FAULT' }
    }
  },
  // Example: diesel aftertreatment
  {
    id: 16,
    scenario_key: 'diesel-aftertreatment',
    symptoms: "DPF regeneration incomplete; excessive soot and reduced engine power.",
    difficulty: 4,
    primarySystem: 'exhaust',
    secondarySystems: ['emissions','engine'],
    symptomCategory: 'diesel-aftertreatment',
    aseArea: 'A8',
    vehicleType: 'diesel',
    faultType: 'mechanical',
    diagnosticMode: 'scan-tool',
    requiredTools: ['Scan Tool','Smoke Machine','Exhaust Gas Analyzer'],
    safetyLevel: 'normal',
    trainingFocus: 'DPF regen procedures and DEF/SCR diagnosis',
    fault: 'dpf_clogged',
    tests: {
      dpf: { system: 'exhaust', reading: 'High soot mass', interpretation: 'CLOGGED' },
      nox: { system: 'emissions', reading: 'Elevated NOx', interpretation: 'UNUSUAL' }
    }
  }
  ,
  // Explicit EV / high-voltage safety scenario example
  {
    id: 17,
    scenario_key: 'hybrid-ev-insulation',
    symptoms: "Hybrid/EV high-voltage insulation fault; vehicle disables on startup.",
    difficulty: 5,
    primarySystem: 'hybrid',
    secondarySystems: ['battery','inverter'],
    symptomCategory: 'hybrid-ev',
    aseArea: 'A6',
    vehicleType: 'hybrid',
    faultType: 'electrical',
    diagnosticMode: 'guided-diagnostics',
    requiredTools: ['HV Insulation Tester','PPE','Scan Tool'],
    safetyLevel: 'high-voltage',
    requiresSafetyAcknowledgment: true,
    trainingFocus: 'HV isolation checks and safety lockout procedures',
    fault: 'hv_isolation_fault',
    tests: {
      hv: { system: 'hybrid', reading: 'Insulation resistance low', interpretation: 'FAIL' },
      inverter: { system: 'hybrid', reading: 'Inverter disabled', interpretation: 'FAULT' }
    }
  },
  // Automatic transmission engagement concern
  {
    id: 18,
    scenario_key: 'automatic-transmission-delayed-drive',
    symptoms: 'Delayed or harsh shift into Drive.',
    difficulty: 3,
    primarySystem: 'transmission',
    secondarySystems: ['hydraulic-control', 'transmission-fluid'],
    symptomCategory: 'automatic-transmission',
    aseArea: 'A2',
    vehicleType: 'gasoline',
    faultType: 'mechanical',
    diagnosticMode: 'basic',
    requiredTools: ['Scan Tool', 'DVOM', 'Fluid Service Information'],
    safetyLevel: 'normal',
    trainingFocus: 'Correlate engagement quality with fluid condition and transmission control data.',
    fault: 'low_or_degraded_transmission_fluid',
    tests: {
      fluid: { system: 'transmission', reading: 'Fluid level below specified range; fluid is darkened.', interpretation: 'FLUID_CONDITION_CONCERN' },
      scan: { system: 'transmission-control', reading: 'Delayed engagement observed without an active transmission DTC.', interpretation: 'CORRELATE_WITH_DATA' }
    }
  },
  // Manual transmission no-drive concern
  {
    id: 19,
    scenario_key: 'manual-transmission-no-drive',
    symptoms: 'Clutch pedal feels normal but vehicle will not move in gear.',
    difficulty: 3,
    primarySystem: 'transmission',
    secondarySystems: ['clutch', 'driveline'],
    symptomCategory: 'manual-transmission',
    aseArea: 'A3',
    vehicleType: 'gasoline',
    faultType: 'mechanical',
    diagnosticMode: 'basic',
    requiredTools: ['Visual Inspection Tools', 'Service Information'],
    safetyLevel: 'normal',
    trainingFocus: 'Differentiate clutch engagement concerns from downstream driveline faults.',
    fault: 'clutch_disc_or_pressure_plate_failure',
    tests: {
      clutch: { system: 'clutch', reading: 'Pedal travel appears normal; engine speed rises without vehicle movement.', interpretation: 'CLUTCH_ENGAGEMENT_CONCERN' },
      driveline: { system: 'driveline', reading: 'No external axle damage observed during visual inspection.', interpretation: 'CONTINUE_SYSTEMATIC_DIAGNOSIS' }
    }
  },
  // Differential speed-related noise concern
  {
    id: 20,
    scenario_key: 'differential-speed-whine',
    symptoms: 'Whine or howl that changes with vehicle speed.',
    difficulty: 3,
    primarySystem: 'driveline',
    secondarySystems: ['differential', 'wheel-bearings'],
    symptomCategory: 'differential',
    aseArea: 'A3',
    vehicleType: 'gasoline',
    faultType: 'mechanical',
    diagnosticMode: 'basic',
    requiredTools: ['Chassis Ears', 'Service Information', 'Visual Inspection Tools'],
    safetyLevel: 'normal',
    trainingFocus: 'Correlate speed-related noise with differential lubricant condition and driveline observations.',
    fault: 'differential_bearing_wear',
    tests: {
      lubricant: { system: 'differential', reading: 'Lubricant level is low with metallic debris present.', interpretation: 'DIFFERENTIAL_INTERNAL_WEAR_CONCERN' },
      noise: { system: 'driveline', reading: 'Whine changes with road speed rather than engine speed.', interpretation: 'SPEED_RELATED_DRIVELINE_CONCERN' }
    }
  },
  // Transaxle fluid-leak and shift-quality concern
  {
    id: 21,
    scenario_key: 'transaxle-fluid-leak-shift-hesitation',
    symptoms: 'Fluid leak with shift hesitation or gear noise.',
    difficulty: 4,
    primarySystem: 'transmission',
    secondarySystems: ['transaxle', 'transmission-fluid'],
    symptomCategory: 'transaxle',
    aseArea: 'A3',
    vehicleType: 'gasoline',
    faultType: 'mechanical',
    diagnosticMode: 'scan-tool',
    requiredTools: ['Scan Tool', 'Fluid Service Information', 'Visual Inspection Tools'],
    safetyLevel: 'normal',
    trainingFocus: 'Relate external fluid loss to transaxle shift quality and recorded operating data.',
    fault: 'transaxle_fluid_loss',
    tests: {
      leak: { system: 'transaxle', reading: 'Fluid residue is present near the axle-seal area.', interpretation: 'EXTERNAL_FLUID_LEAK_CONCERN' },
      scan: { system: 'transmission-control', reading: 'Shift hesitation is reported without a current electrical control DTC.', interpretation: 'CORRELATE_FLUID_AND_OPERATIONAL_EVIDENCE' }
    }
  }
];

// Normalize and apply defaults to every scenario
window.scenarios.forEach(validateScenarioMetadata);

// Expose helper for external tools/validation
window.normalizeScoringWeights = normalizeScoringWeights;


