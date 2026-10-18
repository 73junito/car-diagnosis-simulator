# Automotive Circuit Lab — standalone theoretical calculations

**Developmental module:** `engine/circuitLabCalculations.js`; no UI connection, student records, grading, telemetry, or vehicle diagnosis. Implements only **ideal steady-state DC resistive** calculations, not transient ignition primary coil behavior.

- `current({voltageV,resistanceOhm})`: I = V/R, amperes.
- `voltage({currentA,resistanceOhm})`: V = IR, volts.
- `resistance({voltageV,currentA})`: R = V/I, ohms; zero current rejected.
- `power({voltageV,currentA})`: P = VI, watts; signed power convention depends on terminal polarity.
- `calculate({voltageV,resistanceOhm})`: predicted I and P alongside model assumptions and explicit no-assessment authority.
- `compare({predicted,measured,unit})`: measurement minus prediction, absolute magnitude and magnitude-relative percentage if predicted is nonzero; absent actual measurements return `not_supplied`.

Example: a **fictional** ideal 12 V source across 6 ohms predicts 2 A and 24 W. These values are not manufacturer data and are not measurements of an actual ignition coil. No comparison result is a pass/fail or a determination that a vehicle complies with specifications. An independent, applicable manufacturer specification, operating conditions, instrument uncertainty, and instructor/SME criteria are required for a technical verdict.

Validation rules require finite numeric inputs and positive constant resistance; null or omitted measurements are not invented; 0 predicted values have undefined percentage deviation. Inputs are in SI units as named; callers must convert units and associate instrument calibration and operating conditions before making physical claims.

**Learning alignment:** `data/curriculum/aut250-theoretical-measurements-outcome.json`; supports calculation, unit checking, discrepancy description, and assumption evaluation. The ignition-coil R2 primary is an inductive switching transient; any future RL model requires independently reviewed resistance, inductance, circuit topology, initial conditions and switching conditions. A static Ohm's law model must not simulate its transient waveform.

**Release restrictions:** not approved for high-stakes student assessment, instructor-facing grading, manufacturer compliance claims, or production activation; no existing engine, test eligibility, curriculum catalog, UI, and student data flow is modified.
