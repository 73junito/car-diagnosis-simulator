# Laboratory Domain Coverage and Staged Engine Validation

Status: Gate 2B coverage plan
Machine-readable source: `data/architecture/lab-domain-coverage.json`

## Purpose

Map each canonical laboratory to the engineering domains and operating modes it
requires, and state the staged plan for validating each domain engine.

This is a coverage plan. It is not evidence that any model, engine, or
laboratory is operational. Laboratory identity and lifecycle remain owned by
`data/lmf/lab-registry.json`, which this plan does not duplicate or replace.

## Coverage matrix

| # | Laboratory | Lifecycle | Primary domain | Coupled domains |
| --- | --- | --- | --- | --- |
| 1 | `circuit-lab` (Charging / Circuit) | existing | electrical | network-control |
| 2 | `starting-system-lab` | existing | electrical | mechanical |
| 3 | `relay-load-lab` | existing | electrical | network-control |
| 4 | `sensor-lab` | existing | electrical | network-control |
| 5 | `actuator-lab` | existing | electrical | mechanical, network-control |
| 6 | `network-lab` | existing | network-control | electrical |
| 7 | `multivoltage-lab` | existing | electrical | thermal, powertrain |
| 8 | `engine-mechanical-lab` | planned | mechanical | thermal |
| 9 | `brake-systems-lab` | planned | hydraulic | mechanical, vehicle-dynamics |
| 10 | `steering-suspension-alignment-lab` | planned | vehicle-dynamics | mechanical |
| 11 | `drivetrain-manual-lab` | planned | powertrain | mechanical |
| 12 | `automatic-transmission-lab` | planned | hydraulic | mechanical, network-control |
| 13 | `hvac-thermal-lab` | planned | thermal | electrical, hydraulic |
| 14 | `engine-performance-lab` | planned | powertrain | thermal, network-control |
| 15 | `emissions-lab` | planned | thermal | powertrain, network-control |
| 16 | `adas-vehicle-dynamics-lab` | planned | vehicle-dynamics | network-control, electrical |
| 17 | `advanced-diagnostics-integration-lab` | planned | integrated-diagnostics | all seven others |

A single laboratory may require more than one domain engine. The HVAC laboratory,
for example, needs thermal, electrical and fluid modelling together.

## Domain engine status

| Domain | Engine status | First laboratory | Validation method required |
| --- | --- | --- | --- |
| electrical | in development (Gate 2C) | starting-system | hand calculation, ngspice, residual and power balance |
| network-control | planned | network-lab | protocol conformance and physical-layer separation |
| mechanical | planned | engine-mechanical | closed-form mechanical relations plus reference cases |
| hydraulic | planned | brake-systems | pressure and flow continuity, conservation checks |
| thermal | planned | hvac-thermal | energy balance and pressure-temperature relationships |
| powertrain | planned | engine-performance | torque and speed relations with reference cases |
| vehicle-dynamics | planned | steering-suspension-alignment | geometry and force balance with sign conventions |
| integrated-diagnostics | planned | advanced-diagnostics | composed-model governance across domains |

## Staged engine-validation plan

| Stage | Scope | Exit criterion |
| --- | --- | --- |
| Gate 2C | electrical MNA engine | independent hand calculations and ngspice fixtures agree; failures correctly classified; residuals enforced |
| Gate 3 | Starting-System pilot | complete accessible 2D workflow; production route unchanged until release approval |
| Gate 4 | remaining six electrical laboratories | each passes its own engineering and accessibility acceptance gates |
| Gate 5 | recorded vehicle diagnostics | recorded data compares against compatible predictions without conflating data and simulation |
| Gate 6 | electrical plus thermal cooling fan | a cross-domain scenario explains expected-versus-observed differences |
| Gate 7 | mechanical, hydraulic, powertrain, dynamics, emissions | each domain has independent reference cases; each laboratory passes its own validation |
| Gate 8 | authorized vehicle gateway | compatible hardware validated; security controls tested; unsupported capabilities fail closed |
| Gate 9 | advanced integrated diagnostics | engineering, security, accessibility and instructional evaluation completed |

## Validation rules that apply to every domain

1. Each domain must provide **independently authored** reference cases that do
   not consume the implementation under test.
2. Translation and numerical solution are validated **separately**, so a shared
   mapping error cannot be reproduced in both the implementation and its oracle.
3. A domain that cannot answer returns a declared failure. It must never
   substitute a plausible number, and it must never convert an unavailable value
   into zero.
4. No domain may be validated solely against expectations derived from its own
   implementation.
5. Automated engineering success is not instructional validation. Each
   laboratory is also reviewed by instructors and evaluated against learner
   outcomes before being described as production-ready.

## Mode availability

Engineering Mode is declared available for all 17 laboratories as a target.
Diagnostic Mode and Integrated Mode are deliberately **not** declared available
in Gate 2B: they require the vehicle-data path and cross-domain composition that
later stages introduce. Declaring them early would overstate readiness.
