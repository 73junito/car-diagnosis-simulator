# Engineering Parameter Foundation

## Purpose

The engineering-parameter layer separates circuit topology from numerical engineering values. Symbols and reusable circuit templates define what a component is and how it is connected; engineering profiles define optional values used for training calculations, measurements, or sourced specifications.

This prevents a reusable symbol such as a battery, sensor, relay, motor, or wire from silently inheriting one universal automotive value.

## Value roles

Every engineering quantity declares exactly one `valueRole`:

- `declared_system_value` — an architecture value explicitly declared by the circuit, such as a nominal voltage domain.
- `generic_training_example` — a project-authored example used to teach a relationship. It is not a diagnostic specification.
- `calculated_value` — a deterministic result derived from named inputs and a stored formula.
- `authoritative_specification` — a specification that must carry a source identifier.
- `measured_value` — an observed value supplied by a learner, instrument, simulator, or data source.

The user interface must not present these roles as interchangeable.

## Quantities and units

The initial quantity contract supports voltage, current, resistance, power, energy, capacity, frequency, duty cycle, temperature, conductor length, conductor area, resistivity, voltage drop, and power loss.

Values may be represented as either:

- one scalar `value`; or
- a `range` with `min`, optional `nominal`, and `max`.

A quantity may also carry a percentage or absolute tolerance.

## Component profiles

The initial profile types are:

`battery`, `conductor`, `fuse`, `switch`, `relay`, `resistive_load`, `motor`, `solenoid`, `sensor`, `actuator`, `controller`, `connector`, `network_bus`, `converter`, and `inverter`.

Signal-aware profiles may declare:

`analog_voltage`, `resistive`, `digital`, `pwm`, `frequency`, `can`, or `lin`.

Battery profiles may declare chemistry independently from electrical quantities. The initial chemistry vocabulary includes flooded lead-acid, AGM, EFB, gel, lithium-ion, and other.

## Calculation engine

The initial deterministic calculation engine provides:

- Ohm's law: `I = V / R`, `V = I × R`, `R = V / I`
- electrical power: `P = V × I`
- conductor resistance: `R = ρ × L / A`
- voltage drop: `Vdrop = I × R`
- conductor power loss: `Ploss = I² × R`
- load voltage after a modeled drop: `Vload = Vsource − Vdrop`

The engine does not silently assume conductor material, resistivity, wire length, cross-sectional area, temperature, battery state, or component specification. Those inputs must be explicitly supplied.

Every result returned by the calculation engine is marked `calculated_value` and includes formula/input provenance.

## Training-example catalog

`data/engineering/training-examples.json` contains project-authored examples used to validate and demonstrate the contracts.

The catalog is deliberately not a specification database. Its validator requires every stored quantity to remain `generic_training_example`.

## Evidence rule

A generic example must never become a diagnostic limit merely because it is present in the application.

Vehicle-specific limits used for diagnosis, grading, or assessment require an authoritative specification record with source provenance. Calculated values remain calculations, and measured values remain measurements.

## Next integration phase

After this foundation is merged, existing labs can optionally attach engineering profiles without changing their circuit topology. The Circuit Composer can then use the same contracts to assign values, run calculations, compare healthy and faulted conditions, and preserve the distinction between examples, calculations, measurements, and sourced specifications.

## First lab integration: relay-controlled load

The 12 V relay-controlled load lab is the first consumer of the engineering-parameter foundation.

Its lab-specific profile lives at `data/engineering/labs/relay-load-training.json` and remains separate from both the reusable symbol library and the reusable circuit topology. The profile declares only generic training examples:

- a 6 ohm load resistance;
- explicit conductor resistivity, length, and cross-sectional area for the load power conductor;
- explicit conductor resistivity, length, and cross-sectional area for the load ground conductor;
- a 1.5 ohm added resistance for each high-resistance training fault.

The circuit''s 12 V nominal architecture remains a `declared_system_value`; the component/conductor inputs are `generic_training_example`; current, voltage drop, load voltage, load power, and conductor/fault loss are rendered as `calculated_value`.

The healthy example calculates the full series loop from both modeled conductors. When a high-resistance load-power or load-ground fault is selected, the added example resistance is inserted into the same series model and every dependent value is recalculated.

For an open circuit or an operating state in which the relay-controlled load path is not closed, the lab reports zero load current and zero load power but intentionally does not infer open-circuit voltage distribution. Vehicle-specific diagnostic voltage locations and limits remain outside the generic training model.

## Sensor signal-engineering integration

The 12 V three-wire sensor lab is the second consumer of the engineering-parameter foundation and the first signal-engineering integration.

Its lab-specific profile lives at `data/engineering/labs/sensor-training.json`. The profile keeps the reusable circuit topology separate from numerical training examples.

The circuit template continues to declare:

- `LV12`: 12 V nominal vehicle-system domain
- `SENSOR5`: 5 V nominal training reference

The sensor engineering profile adds only generic training examples:

- normalized training input: 0–100 percent
- analog signal transfer range: 0.5–4.5 V

The reusable engineering calculator now provides a linear transfer function:

`output = min + (input% / 100) × (max − min)`

Every transfer result is marked `calculated_value` and carries formula/input provenance.

Fault behavior is intentionally conservative:

- signal short to ground: controller-observed training signal is forced to ground reference;
- signal short to reference: controller-observed training signal is forced to the declared SENSOR5 reference;
- open signal: ideal sensor transfer can still be shown, but the controller-observed signal is unavailable;
- open sensor power or open sensor ground: sensor output is not inferred;
- high resistance in the sensor ground/reference: a numeric signal is not invented because the result depends on sensor and circuit design.

The student can change the normalized training input with a 0–100 percent slider and see the calculated transfer update immediately. The generic transfer relationship remains visibly distinct from the controller-observed signal under faults.

## PWM actuator engineering integration

The 12 V PWM actuator lab is the third consumer of the engineering-parameter foundation and the first commanded-output engineering integration.

Its lab-specific profile lives at `data/engineering/labs/actuator-training.json`. The reusable circuit topology continues to declare the 12 V nominal architecture, while the profile supplies only generic training-example duty-cycle values.

The reusable engineering calculator now provides:

`Vavg = Vhigh × (duty% / 100)`

This is a mathematical PWM average representation only. It does not define actuator position, speed, force, flow, current, frequency, or what every meter or oscilloscope will report.

Training state presets are:

- low-duty example: 30 percent
- high-duty example: 70 percent

The student may also move the duty-cycle input through 0–100 percent.

Fault behavior remains conservative:

- PWM open: ideal controller command remains calculable, actuator-side command is unavailable;
- PWM short to ground: actuator-side command is idealized to ground;
- PWM short to power: actuator-side command is idealized to the declared 12 V supply;
- actuator power or ground open: command math remains visible, but actuator response is not inferred;
- high-resistance actuator power or ground: path is marked degraded, but voltage drop and actuator response are not invented without a component/load model.

The UI separates commanded duty cycle, ideal mathematical average, actuator-side observed command representation, actuator power availability, and actuator ground availability.
