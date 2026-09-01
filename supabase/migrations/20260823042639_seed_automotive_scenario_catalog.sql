BEGIN;

INSERT INTO public.scenario_catalog (
    scenario_id,
    title,
    description,
    active
)
VALUES
    (
        'no-crank',
        'Engine Will Not Crank',
        'Diagnose a vehicle whose engine does not crank when starting is attempted.',
        true
    ),
    (
        'crank-no-start',
        'Engine Cranks but Does Not Start',
        'Diagnose a vehicle whose engine cranks normally but does not start.',
        true
    ),
    (
        'engine-overheating',
        'Engine Overheats After Driving',
        'Diagnose an engine that overheats after approximately ten minutes of driving.',
        true
    ),
    (
        'headlights-dim-flicker',
        'Headlights Are Dim and Flicker',
        'Diagnose dim or flickering headlights while the vehicle is operating.',
        true
    ),
    (
        'misfire-under-acceleration',
        'Engine Misfires Under Acceleration',
        'Diagnose engine misfire occurring during acceleration.',
        true
    ),
    (
        'steering-alignment',
        'Steering and Alignment',
        'Diagnose steering, suspension, and alignment concerns.',
        true
    ),
    (
        'hvac',
        'Heating, Ventilation, and Air Conditioning',
        'Diagnose automotive heating, ventilation, and air conditioning concerns.',
        true
    ),
    (
        'stalling',
        'Engine Stalling',
        'Diagnose an engine that unexpectedly stalls.',
        true
    ),
    (
        'misfire',
        'Engine Misfire',
        'Diagnose general engine misfire conditions.',
        true
    ),
    (
        'power-loss',
        'Engine Power Loss',
        'Diagnose reduced engine power and acceleration.',
        true
    ),
    (
        'automatic-transmission',
        'Automatic Transmission',
        'Diagnose automatic transmission operating concerns.',
        true
    ),
    (
        'manual-transmission',
        'Manual Transmission',
        'Diagnose manual transmission and clutch operating concerns.',
        true
    ),
    (
        'intermediate-stalling',
        'Intermediate Engine Stalling',
        'Diagnose intermediate-level intermittent engine stalling conditions.',
        true
    ),
    (
        'charging-system',
        'Charging System',
        'Diagnose automotive charging system and battery charging concerns.',
        true
    ),
    (
        'can-bus-network',
        'CAN Bus Network',
        'Diagnose controller area network communication faults.',
        true
    ),
    (
        'hybrid-ev',
        'Hybrid and Electric Vehicles',
        'Diagnose hybrid and electric vehicle system concerns.',
        true
    ),
    (
        'engine-performance',
        'Engine Performance',
        'Diagnose general engine performance concerns.',
        true
    ),
    (
        'emissions',
        'Emissions Systems',
        'Diagnose automotive emissions control system concerns.',
        true
    )
ON CONFLICT (scenario_id) DO NOTHING;

COMMIT;
