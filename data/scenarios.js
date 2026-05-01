// Realistic scenarios for training and assessment
window.scenarios = [
  {
    id: 1,
    symptoms: "Engine will not crank. Clicking sound when key is turned.",
    fault: "battery",
    tests: {
      battery: "Battery voltage is low (11.2V).",
      starter: "Starter relay is receiving weak power.",
      fuel: "Fuel system not relevant for no-crank condition."
    }
  },
  {
    id: 2,
    symptoms: "Engine cranks but does not start.",
    fault: "fuel",
    tests: {
      battery: "Battery is fully charged.",
      fuel: "No fuel pressure detected at rail.",
      ignition: "Spark is present at spark plugs."
    }
  },
  {
    id: 3,
    symptoms: "Engine overheats after 10 minutes of driving.",
    fault: "coolant",
    tests: {
      coolant: "Coolant level is low and leaking.",
      oil: "Engine oil level is normal.",
      battery: "Electrical system is fine."
    }
  },
  {
    id: 4,
    symptoms: "Headlights are dim and flicker while driving.",
    fault: "alternator",
    tests: {
      alternator: "Alternator output is below 12V under load.",
      battery: "Battery is partially discharged.",
      fuel: "Fuel system unaffected."
    }
  },
  {
    id: 5,
    symptoms: "Engine misfires under acceleration.",
    fault: "spark_plugs",
    tests: {
      spark_plugs: "Spark plugs show heavy carbon buildup.",
      fuel: "Fuel pressure is stable.",
      battery: "Battery voltage normal."
    }
  },
  {
    id: 6,
    symptoms: "Car pulls to the right while driving.",
    fault: "alignment",
    tests: {
      alignment: "Wheel alignment is out of specification.",
      brakes: "Brake system is balanced.",
      suspension: "Suspension components worn unevenly."
    }
  },
  {
    id: 7,
    symptoms: "Air conditioning not cooling.",
    fault: "refrigerant",
    tests: {
      refrigerant: "Refrigerant level is low.",
      battery: "Electrical system stable.",
      engine: "Engine operating normally."
    }
  },
  {
    id: 8,
    symptoms: "Engine stalls at idle.",
    fault: "idle_valve",
    tests: {
      idle_valve: "Idle air control valve is stuck.",
      fuel: "Fuel delivery normal.",
      battery: "Voltage stable at idle."
    }
  },
  {
    id: 9,
    symptoms: "Check engine light is on. Code P0300 detected.",
    fault: "misfire",
    tests: {
      misfire: "Random cylinder misfires detected.",
      fuel: "Fuel injectors partially clogged.",
      battery: "Battery fine."
    }
  },
  {
    id: 10,
    symptoms: "Vehicle struggles to accelerate uphill.",
    fault: "transmission",
    tests: {
      transmission: "Transmission slipping under load.",
      engine: "Engine power output normal.",
      fuel: "Fuel system adequate."
    }
  }
];

