# Multi-Domain Engineering and Diagnostic Contracts

Status: Gate 2B architecture record
Scope: shared contracts for all 17 laboratories

## Purpose

Define one shared engineering interface for every laboratory while keeping each
domain's physics in its own numerical engine. The platform is not eight
disconnected calculators, and it is not an electrical-only simulator.

## Architecture

```text
AutoLearnPro browser application
  17 labs | Engineering | Diagnostic | Integrated
                    |
      Unified simulation and diagnostic orchestrator
      vehicle models | model registry | unit contracts
      fault scenarios | solver dispatch | evidence provenance
                    |
  electrical | mechanical | hydraulic | thermal
  powertrain | network-control | vehicle-dynamics | integrated-diagnostics
                    |
      Common measurement and evidence layer
      expected vs observed | time alignment | confidence
      root-cause hypotheses | verification tests
```

Preserved stack: browser JavaScript and TypeScript contracts, Cloudflare
Workers, Supabase, existing engineering artifacts, and the canonical LMF
registry. No React rewrite and no Python backend were introduced. Python and
SciPy remain offline validation tools.

## Separation of concerns

| Concern | Owns | Must never own |
| --- | --- | --- |
| Numerical engine | computed quantities, residuals, failure classification | scoring, publication, conclusions |
| Vehicle communications | observations, quality flags, reported DTCs | engineering truth |
| Presentation | rendering, layout, animation | engineering state |
| Evidence layer | provenance, comparison, hypotheses | authoritative answers |
| Assessment system | scoring, eligibility | (unchanged, external) |

## Contract modules

| File | Contents |
| --- | --- |
| `contracts/primitives.ts` | quantity types, units, source roles, condition class, eight domain ids, three failure axes, failure stages and codes, `FailureDetail` |
| `contracts/quantity.ts` | `Quantity`, `Provenance`, `ValidityCondition`, `QuantityPrecision` (four separate precision concepts), `ResolvedValue` |
| `contracts/vehicle.ts` | `VehicleConfiguration`, `PowertrainKind`, `VoltageDomainDeclaration`, read-only interface declaration |
| `contracts/model.ts` | `ModelManifest`, `ModelCapability`, `ModelState`, `FaultScenario`, `RelayCoupling`, canonical fault class ids |
| `contracts/engine.ts` | `SimulationEngine`, `DomainAdapter`, `DomainRegistry`, `DispatchOutcome`, `MeasurementRequest`, `SimulationRequest`, `SimulationResult`, `InterDomainCoupling` |
| `contracts/measurement.ts` | `ObservedMeasurement`, `ObservationSession`, `ReportedTroubleCode`, `ObservationImportAdapter`, `PredictionComparison` |
| `contracts/modes.ts` | `OperatingMode`, `ModeReuseContract`, Engineering/Diagnostic/Integrated request and result types, `EvidenceRecord`, `DiagnosticHypothesis`, `VerificationPlan`, `StudentReasoningRecord` |

Versioned JSON schemas live in `schemas/`. Type checking is `npm run typecheck`
(strict mode, no emit).

## Mode reuse rule

All three modes resolve against the **same versioned model**. They differ only in
the evidence they add.

| Mode | Model | Observations | Source role |
| --- | --- | --- | --- |
| Engineering | yes | no | `simulation-derived` / `engineering-model-derived` |
| Diagnostic | no | yes | `external-measurement` / `student-entered` |
| Integrated | yes | yes, kept structurally distinct | both |

Comparison is permitted only when quantity type, unit, validity and
applicability all match. On mismatch the result is `not-comparable` — never a
forced numeric difference.

A prediction and a measurement are different types. `EngineeringModeResult`
declares `observations: readonly never[]` and `DiagnosticModeResult` declares
`predictions: readonly never[]`, so a prediction can never be relabelled as a
measurement or the reverse.

## Measurement provenance

Four roles never collapse: a sensor reading, a student-entered observation, a
predicted model value, and a manufacturer specification.

Four precision concepts are kept separate on every quantity: numerical solver
tolerance, declared model precision, instrument accuracy, and display
resolution. Display rounding must not alter the value used for comparison, and
solver tolerance must never be presented to students as measurement
uncertainty. Where no applicable source reference supplies an accuracy figure,
`instrumentAccuracy` is `null` and the reason is stated rather than guessed.

## Failure classification

Three independent axes, so an infrastructure failure is never reported as a
property of the student's circuit:

- **execution** — the engine did not produce a solution (`WORKER_TIMEOUT`,
  `WORKER_CANCELLED`, `WORKER_INIT_FAILED`, `WORKER_UNAVAILABLE`,
  `REQUEST_INVALID`, `RESOURCE_LIMIT`)
- **numerical** — the engine ran and there is no valid solution
  (`MATRIX_ASSEMBLY_FAILED`, `NO_REFERENCE_NODE`, `SINGULAR_MATRIX`,
  `UNDERDETERMINED_SYSTEM`, `RESIDUAL_EXCEEDED`, `NONFINITE_RESULT`,
  `RELAY_STATE_UNRESOLVED`)
- **physical** — the quantity is genuinely undefined
  (`INDETERMINATE_REFERENCE`, `ISOLATED_SUBNETWORK`, `FLOATING_NODE`,
  `OPEN_CIRCUIT`, `UNMEASURABLE_QUANTITY`, `TOOL_CAPABILITY`,
  `ROUTING_REQUIRED`, `TOPOLOGY_UNSUPPORTED`, `CROSS_DOMAIN_PATH`)

`residuals` is `null` wherever no valid solution was produced and is mandatory
only at the `validation` stage. Residuals are never synthesised to satisfy a
schema.

## Cross-domain coupling

`InterDomainCoupling` declares the shared quantity type and unit, the
convergence tolerance and basis, a maximum iteration count, mandatory
provenance, and `fail-closed` behaviour for unsupported states. No domain is
forced through the electrical solver: a CAN or LIN question routes to the
network-control adapter, and an unsupported request returns
`ROUTING_REQUIRED` or `TOPOLOGY_UNSUPPORTED` rather than a plausible number.

## Gate 2B boundary

No numerical engine is implemented in this stage. Every dispatch is a declared
refusal. Automated contract success is not evidence of solver correctness,
educational effectiveness, or vehicle repair accuracy.
