// Realistic scenarios for training and assessment
window.scenarios = [
  {
    id: 1,
    symptoms: "Engine will not crank. Clicking sound when key is turned.",
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
    fault: "transmission",
    tests: {
      transmission: { system: 'transmission', reading: 'Slipping under load', interpretation: 'SLIP' },
      engine: { system: 'engine', reading: 'Power normal', interpretation: 'OK' },
      fuel: { system: 'fuel', reading: 'Adequate', interpretation: 'OK' }
    }
  }
];

