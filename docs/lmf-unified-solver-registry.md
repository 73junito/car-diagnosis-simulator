# Unified LMF solver integration policy

The versioned candidate catalog is `data/lmf/solver-registry.json`. It is a planning and discovery contract, **not** a list of executable adapters.

| ID | Role | Current evidence |
| --- | --- | --- |
| `typescript-mna` | Primary DC electrical adapter candidate | TypeScript implementation exists in `src/simulation/`; the unified runtime is not yet wired to it |
| `ngspice` | Independent SPICE electrical reference | Reference netlists exist in `engineering/ngspice/`; no unified native execution |
| `openmodelica` | Mechanical, thermal, fluid, electrical, and powertrain modeling candidate | Not integrated |
| `omsimulator` | FMI/FMU co-simulation candidate | Not integrated |
| `opendss` | Specialized electric distribution reference candidate | Not integrated; not the automotive default |

## Integration gates

1. Review licensing, supported versions, packaging, and solver invocation for the deployment environment.
2. Explicitly constrain allowed model references, resources, subprocess use, CPU/memory/time budgets, and network access. Do not execute arbitrary user-provided netlists, scripts, or FMUs.
3. Implement a typed adapter satisfying current `modelRef`, `operatingStateId`, optional `faultId`, and measurement-request semantics. Declare solver/model versions and provenance.
4. Validate against independently reviewed engineering reference cases with documented tolerances, fault behavior, and failure cases.
5. Keep display state, diagnostic score, assessment eligibility, and publication approval outside the solver.
6. Promote to usable status only after the adapter, test evidence, security review, and environment-specific release approval are separately recorded.

Until then, `requestSolver(solverId)` returns `integration-not-authorized` and no measurement. The Charging-System headless foundation also continues to return `solver-not-connected` until an appropriate electrical implementation is verified and wired.
