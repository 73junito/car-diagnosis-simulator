# Competitive Technical Gap Matrix

Status: Working architecture/roadmap record  
Baseline: `main@fe9ea2cb234b088de4ad31e8f6e741d110c63c03`  
Review date: 2026-09-26

## Purpose

This document compares the current AutoLearnPro / Car Diagnosis Simulator architecture with representative automotive learning and diagnostic-training products. It is a planning aid, not a product ranking.

The comparison uses public vendor documentation. A capability marked "not publicly documented" must not be interpreted as proof that a competitor lacks the capability.

## Architectural identity

The project is being developed as a browser-based automotive engineering and diagnostic learning environment in which:

- engineering values carry explicit evidence roles;
- project-authored mathematical models are not represented as vehicle specifications;
- source-backed limits are applied only when their applicability matches the measurement and condition;
- unsupported values remain unavailable rather than being inferred;
- incompatible domains remain not comparable rather than producing plausible but invalid numeric results;
- diagnostic presentation is built on reusable engineering contracts rather than UI-specific assumptions.

The reusable comparison runtime is `src/engineering/comparisons.js`.

## Representative products

### Electude

Public documentation describes a browser-based engine-management simulator with configurable faults, multiple difficulty levels, work orders, diagnostic tools, multimeter/oscilloscope interaction, CAN-network representation, live data, actuator tests, and instructor-created fault scenarios.

Sources:
- https://www.electude.com/support/electude-simulator/
- https://simulator.electude.com/
- https://simulator.electude.com/sim/help/US.html

### CDX Learning

Public documentation describes a broad automotive curriculum platform with interactive content, videos, 3D animations, quizzes/tests, tasksheets, grading, analytics, course management, and strategy-based diagnostic instruction.

Sources:
- https://www.cdxlearning.com/automotive/fundamentals-of-automotive-technology
- https://www.cdxlearning.com/automotive/maintenance-and-light-repair

### ConsuLab

Public documentation describes physical automotive trainers using real or representative components, measurable circuits, instructor-inserted faults, scan-tool/oscilloscope access, CAN/J1939 and OBD-II training, starting/charging systems, sensors, and repeatable diagnostic exercises.

Sources:
- https://www.consulab.com/products/fp-mf900-vets-vehicle-electrical-training-system
- https://www.consulab.com/products/mp-750-052808-multiplex-network-diagnostic-trainer
- https://www.consulab.com/products/mp-1918-2s-053379-single-sided-can-bus-multiplex-system-trainer

### Lucas-Nuelle

Lucas-Nuelle is retained as a comparison category for integrated automotive training hardware/software, diagnostic measurement, vehicle-network instruction, and fault simulation. Claims about individual feature counts or internal implementation should be added only when supported by a current primary source during a future review.

### Today's Class

Today's Class is retained as a comparison category for learner-management, short-form training, personalization, reinforcement, and progress analytics. It is not treated as a direct engineering-simulation equivalent.

## Capability matrix

Legend:

- **Current** — implemented and validated in this repository.
- **Next** — near-term work that directly strengthens the engineering/evidence architecture.
- **Later** — valuable after the engineering foundation and data contracts are stable.
- **Not in scope** — should not be pursued merely for competitive parity.
- **External strength** — a capability that is central to an established comparison product and is not currently a project strength.
- **Not publicly documented** — no conclusion is drawn about the competitor's internal architecture.

| Capability | AutoLearnPro state | Market reference | Roadmap treatment |
| --- | --- | --- | --- |
| Browser-based student labs | Current | Electude and CDX provide browser-delivered learning experiences | Maintain |
| Reusable healthy-vs-fault comparison engine | Current | Fault scenarios are common; an equivalent evidence-role API is not publicly documented | Maintain/core |
| Explicit `unavailable` outcome | Current | Not publicly documented as an architectural contract | Maintain/core |
| Explicit `not_comparable` outcome | Current | Not publicly documented as an architectural contract | Maintain/core |
| Separation of training-model delta from authoritative limits | Current | Not publicly documented as an architectural contract | Maintain/core |
| Source/applicability-aware reference comparison | Current | Physical trainers can provide authentic measurements; internal evidence-role handling is not publicly documented | Maintain/core |
| Relay/load modeling | Current | Common electrical-training capability | Maintain |
| Sensor modeling | Current | Common simulator/trainer capability | Maintain |
| PWM actuator modeling | Current | Common advanced electrical-training capability | Maintain |
| Starting-system reference comparison | Current | Common curriculum/trainer domain | Maintain |
| Charging-system applicability boundary | Current | Common curriculum/trainer domain | Maintain |
| Multi-voltage domain isolation | Current | Modern platforms include electrified-vehicle content | Maintain/core |
| Reproducible scientific model artifacts | Next | Not a primary publicly advertised feature of the comparison platforms | Build next |
| NumPy/SciPy mathematical-model pipeline | Next | Internal competitor implementations generally not public | Build next |
| pandas analysis pipeline | Next | Analytics exist in learning platforms, but engineering-artifact analysis is a different concern | Build next |
| Matplotlib engineering plots | Next | Visualization exists broadly; reproducible generated engineering plots are the project goal | Build next |
| Circuit-simulation validation with ngspice | Next after artifact contract | Physical trainers provide real circuit behavior; browser simulators use proprietary models | Build after schema |
| Control-system modeling | Later | Relevant to advanced system behavior | Later |
| Virtual multimeter / oscilloscope depth | Partial | Electude has mature virtual diagnostic tools | Later, after models |
| CAN communication exercises | Later | Electude and ConsuLab provide network-diagnostic training | Later |
| OBD-II communication exercises | Later | ConsuLab provides scan-tool/DLC-based training | Later |
| Instructor-created fault authoring | Limited | Electude has mature instructor-configurable fault creation | Later |
| Work orders / diagnostic job flow | Limited | Electude has work-order-driven simulation | Later |
| Large curriculum/content library | Limited | CDX and Electude are established strengths | Grow deliberately |
| Gradebook / institutional analytics | Developing | CDX and other learning platforms are stronger | Later/integration |
| Adaptive reinforcement | Not core today | Personalized learning platforms emphasize this area | Later |
| Physical trainer integration | Not current | ConsuLab and Lucas-Nuelle are strong here | Future integration, not imitation |
| Proprietary hardware manufacturing | Not current | Core strength of hardware vendors | Not in scope unless strategy changes |
| Feature-for-feature competitor cloning | Not applicable | — | Not in scope |

## Gap priorities

### Current — preserve

The following behaviors are architectural invariants, not temporary UI features:

1. No project-authored model value becomes an authoritative vehicle specification by presentation alone.
2. No unsupported open-circuit, degraded, or fault behavior is numerically inferred merely to fill the UI.
3. Measurements and references must match quantity semantics, units, domain, and applicability before authoritative comparison.
4. Cross-domain multi-voltage faults must not create false comparisons.
5. A missing or incompatible comparison must remain explicit through `unavailable` or `not_comparable`.
6. Numeric training deltas may describe modeled change without implying pass/fail, vehicle fitness, or a universal diagnostic limit.

### Next — engineering computation foundation

The next implementation phase should establish a tool-neutral artifact contract before adding multiple simulation technologies.

Minimum deliverables:

- versioned engineering-model JSON schema;
- explicit provenance/evidence-role field;
- quantity type and unit contract;
- baseline and observed/fault representation;
- authoritative-specification boolean or equivalent semantic;
- applicability/domain metadata;
- generator/tool metadata and version;
- deterministic validation;
- Python environment;
- NumPy and SciPy modeling;
- pandas artifact inspection;
- Matplotlib plot generation;
- one reproducible relay/load example;
- CI validation of generated artifacts.

The browser comparison runtime should consume validated artifacts through adapters rather than importing Python implementation details.

### After the artifact contract

Add ngspice as the first external physics simulator. Its output should be normalized into the same artifact contract and must not bypass evidence-role or applicability rules.

Candidate first models:

- relay/load circuit;
- open load path;
- added series resistance;
- voltage-divider sensor;
- PWM/load electrical behavior;
- voltage-drop measurement examples.

### Later

Once model contracts and reproducibility are stable:

- control-system modeling;
- CAN message exercises;
- OBD-II exercises;
- virtual instrument depth;
- instructor scenario authoring;
- work-order workflow;
- institutional analytics and assignment integration;
- optional hardware interface adapters.

Machine-learning output, if introduced, must remain a separate evidence role. A model prediction must never silently become an authoritative reference result.

## Strategic boundary

The project should not compete by duplicating every feature in mature curriculum or hardware platforms.

Its differentiating technical direction is:

> Make the evidence chain behind a diagnostic learning result explicit, reproducible, and inspectable.

The desired flow is:

```text
source evidence / project model
        |
        v
evidence role + engineering contract
        |
        v
validated computation artifact
        |
        v
measurement/comparison runtime
        |
        +--> changed / unchanged
        +--> unavailable
        +--> not_comparable
        +--> reference-only
        +--> source-applicable reference result
        |
        v
student diagnostic experience
```

This keeps the educational interface downstream of the engineering evidence instead of making the interface itself the source of engineering truth.

## Review rule

Revisit this matrix when any of the following occurs:

- a new computation engine is added;
- CAN/OBD communication enters implementation;
- instructor-authored diagnostic scenarios are introduced;
- physical hardware integration is proposed;
- institutional curriculum/assessment requirements materially change;
- competitor public capabilities materially change.

Update competitor claims only from current public primary sources where practical.
