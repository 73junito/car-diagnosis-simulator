# Engineering Computation Foundation

## Scope

This foundation introduces a tool-neutral artifact contract between scientific computation and the browser diagnostic runtime.

The first generator uses Python with NumPy, SciPy, pandas, and Matplotlib. Those libraries are implementation tools; they are not evidence authorities. Generated values retain an explicit evidence role.

## Initial flow

```text
project-authored model inputs
        |
        v
Python scientific computation
        |
        v
versioned JSON artifact
        |
        v
schema + semantic validation
        |
        v
future browser adapter
        |
        v
engineering comparison runtime
```

## Evidence boundary

The committed relay/load artifact is a generic project-authored training model. Its numeric result reproduces the existing example:

- healthy current: 1.989 A
- high-resistance model current: 1.593 A
- delta: -0.396 A

These values are not a vehicle specification and cannot be converted into an authoritative pass/fail result by the artifact contract.

## Files

- `data/engineering/schemas/engineering-model-artifact.schema.json` — versioned structural contract.
- `data/engineering/generated/relay-load-high-resistance.json` — committed deterministic example.
- `engineering/python/requirements.txt` — scientific Python dependencies.
- `engineering/python/generate_relay_load_model.py` — reproducible generator; also emits CSV and PNG locally.
- `scripts/verify-engineering-artifacts.js` — schema and semantic validator.
- `tests/engineering-artifact-contract.test.js` — regression tests for evidence boundaries.

## Generation

From the repository root, after creating a Python environment and installing `engineering/python/requirements.txt`:

```text
python engineering/python/generate_relay_load_model.py
```

The script writes JSON, CSV, and PNG outputs under `data/engineering/generated/`. JSON is the contractual interchange format. CSV and PNG are derived analysis/visualization outputs.

## Validation

```text
node scripts/verify-engineering-artifacts.js
```

Validation deliberately applies rules that JSON Schema alone cannot express safely, including:

- project-authored models cannot declare themselves authoritative specifications;
- project-authored models cannot use authoritative reference statuses;
- changed/unchanged deltas must equal observed minus baseline;
- unavailable values must remain explicitly unavailable;
- project-model provenance must retain the project-authored training-model evidence role.

## ngspice integration

The first independent circuit-simulation backend uses `engineering/ngspice/relay-load-high-resistance.cir`.

Run:

```text
npm run validate:ngspice-relay
```

The adapter:

1. executes ngspice in non-interactive batch mode;
2. reads healthy and high-resistance operating-point currents;
3. normalizes them into the same engineering artifact contract;
4. validates the generated artifact;
5. compares the rounded SPICE result with the committed Python artifact using a 0.001 A tolerance.

The generated ngspice JSON artifact is intentionally not committed because simulator version metadata may vary by environment. The contract and numerical cross-check are the reproducibility boundary.

ngspice remains a computation tool, not an evidence authority. Its output retains `project_authored_training_model`, `numeric_delta_only`, and `authoritativeSpecification: false`.

## Sensor model cross-validation

The sensor model extends the same contract to a different electrical behavior class:

- healthy generic transfer: 2.500 V at 50% normalized input;
- signal short-to-ground: 0.000 V modeled controller signal;
- numeric delta: -2.500 V;
- high-resistance sensor ground: unavailable by design because the actual response depends on sensor and circuit design.

Run:

```text
python engineering/python/generate_sensor_model.py
npm run validate:sensor-model
```

The numeric short-to-ground case is independently cross-validated with ngspice to within 0.001 V. The degraded-ground case deliberately has no SPICE numeric result because the training profile does not define enough component behavior to justify one.

## PWM actuator model cross-validation

The actuator model validates a transient PWM command representation without inferring physical actuator response.

At the default training state:

- supply: 12 V;
- duty cycle: 30%;
- ideal mathematical average: 3.600 V;
- PWM short-to-ground: 0.000 V average;
- delta: -3.600 V.

Run:

```text
python engineering/python/generate_pwm_actuator_model.py
npm run validate:pwm-actuator-model
```

ngspice performs a transient pulse simulation and measures average command voltage over repeated cycles. The normalized result must agree with the Python mathematical model within 0.001 V.

An open PWM command remains `unavailable`. The model does not infer actuator position, speed, force, flow, current, frequency response, or mechanical behavior from PWM average voltage.

## Starting-system voltage-drop cross-validation

The starting-system model is the first computation case that is also exercised against an existing source-backed reference.

Project-authored cable-resistance cases are evaluated at the repository's selected 500 A source-backed 12 V cable-test current:

- 0.000700 ohm -> 0.350 V modeled total cable drop;
- 0.000900 ohm -> 0.450 V modeled total cable drop.

Python and ngspice must agree within 0.001 V.

The model artifacts remain `project_authored_training_model` with `numeric_delta_only`. They do not contain an authoritative pass/fail result.

A separate regression test selects the existing source-backed 12 V 50MT maximum cable-drop reference of 0.400 V and sends test-only simulated readings through the existing measurement/reference comparison runtime:

- 0.350 V -> `within_reference`;
- 0.450 V -> `exceeds_reference`;
- open circuit -> `not_comparable`.

This separation is intentional: the computation produces a modeled value; the authoritative source record supplies the applicable limit.

Run:

```text
python engineering/python/generate_starting_voltage_drop_model.py
npm run validate:starting-voltage-drop-model
```

## Charging-system applicability validation

Charging-system work adds a stricter source-applicability gate rather than inventing a new charging voltage-drop model.

The existing source catalog contains distinct 12 V charging references, including:

- 0.300 V as a new-vehicle cable-sizing design basis;
- 0.500 V as a life-of-vehicle maximum cable-drop basis;
- 0.200 V maximum specifically for a 3-wire charging-system #2 lead.

A new `evaluateSpecificationApplicability` function checks all constraints declared by the selected source reference before authoritative comparison. Constrained fields include system, system voltage, test method, wiring configuration, conductor, and starter family when applicable.

This produces the intended charging behavior:

- exact 12 V / 3-wire / #2 lead context -> the 0.200 V maximum may be applied;
- alternator-ground fault -> the #2 lead reference is `not_comparable`;
- missing wiring/conductor context -> the constrained reference is not applicable;
- open charging path -> authoritative numeric comparison is `not_comparable`;
- the 0.300 V new-vehicle design-basis value remains `reference_only`, not a pass/fail limit.

Catalog discovery remains intentionally broad. Strict applicability is enforced only when a source record is actually used for interpretation.

## Multi-voltage domain isolation

The comparison layer now supports explicit electrical-domain identity.

When engineering quantities declare `electricalDomain.voltageSystemId`, healthy-vs-observed comparison requires matching voltage-system IDs. A low-voltage quantity from `LV12` cannot be numerically compared with a traction-domain quantity from `TR400` merely because both use volts.

Measured quantities may also carry:

- `measurement.context.voltageSystemId`;
- `measurement.context.nominalVoltage`.

When an authoritative reference declares `applicability.systemVoltage`, a measurement with a different declared nominal voltage is `not_comparable`.

This preserves:

- LV12 ↔ LV12 comparison;
- rejection of LV12 ↔ TR400 comparison;
- rejection of a 400 V-domain measurement against a 12 V charging reference;
- same-domain reference comparison behavior;
- existing legacy quantities that do not yet declare domain metadata.

The guard does not infer conversion ratios, DC/DC efficiency, traction current, motor output, or cross-domain equivalence.

## Browser engineering artifact adapter

The browser runtime now has a shared artifact adapter and registry. The registry maps a lab/fault/use case to a specific committed engineering artifact and fixed model context, while the adapter validates artifact identity, evidence role, quantity type, unit, and authority flag before exposing values to a lab.

The first migrated cases are deliberately narrow:

- sensor short-to-ground at the nominal 50% training input;
- PWM actuator short-to-ground at the nominal 30% duty-cycle state.

At those exact registered states the labs consume the committed validated artifact values. If the learner changes the control away from the registered model context, the artifact is not applied and the existing calculator/fault-behavior path remains in control.

This prevents a fixed generated artifact from being silently reused outside the conditions that produced it.

The adapter also fails closed if an artifact is replaced with a different artifact ID, evidence role, quantity type/unit, or authoritative-specification flag.

Run:

```text
npm run validate:browser-engineering-artifacts
```

## Next boundary

After the adapter is proven in these two fixed-context cases, migrate the relay/load model and then source-backed starting-system scenarios through the same registry without weakening their existing applicability and evidence boundaries.
