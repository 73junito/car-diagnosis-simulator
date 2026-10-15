# AutoLearnPro Lab Management Framework — LMF-1 through LMF-6

This directory establishes the first six platform-wide lab-management contracts without changing production lab behavior.

## Contracts

- **LMF-1 — Canonical Lab Registry:** `lab-registry.json` defines the 17 reusable diagnostic workspaces, their domains, lifecycle state, engineering adapter references, shared tools, and direct-practice routes where they already exist.
- **LMF-2 — Scenario → Lab Mapping:** `scenario-lab-mappings.json` lets governed scenarios select a workspace while explicitly prohibiting mappings from becoming engineering, assessment, or publication authority.
- **LMF-3 — Engineering Model Adapter Interface:** `engineering-model-adapters.json` defines a common adapter boundary across electrical, communications, mechanical, hydraulic, thermal, drivetrain, ADAS, and integrated systems.
- **LMF-4 — Shared Diagnostic Tool Manager:** `diagnostic-tools.json` registers reusable diagnostic tools and the measurement types they can request or display.
- **LMF-5 — Universal Measurement Contract:** `measurement-contract.json` defines common measurement identity, source roles, units/families, provenance expectations, and prohibited scoring/publication authority.
- **LMF-6 — Canonical Fault Taxonomy:** `fault-taxonomy.json` classifies faults across domains and maps the five fault types already present in the circuit templates into stable platform classes.

## Non-negotiable authority boundaries

```text
question / scenario = instructional context
lab mapping         = workspace selection
engineering model   = physical / electrical / hydraulic / thermal truth
tool                = measurement interface
measurement record  = observation with provenance
fault taxonomy      = classification
presentation        = visualization
assessment system   = scoring / eligibility
human governance    = publication approval
```

No LMF-1 through LMF-6 artifact may grant assessment eligibility, create a correct answer, synthesize human approval, or publish content.

## Lifecycle

The registry distinguishes `existing` workspaces from `planned` workspaces. A planned registry entry is an architectural reservation only; it does not claim that an engineering model, runtime, route, or instructional asset is production-ready.

## Validation

Run:

```bash
npm run validate:lmf-foundation
```

The validator checks cross-registry integrity, unique IDs, tool/adapter references, known domains, scenario mapping targets, universal measurement references, legacy fault coverage, and authority-leakage guardrails.
