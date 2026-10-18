# AUT-250 Proposed R2 Ignition-Coil Technical Truth Table

**Not approved for instruction or real-world service.** Proposed fictional four-cylinder engine with individually mounted, externally switched, two-terminal ignition-coil primaries. This is a design assumption, not a vehicle specification. The operative simulator remains R1 and its existing illustrative values cannot be adopted as service specifications.

## Diagnostic hypothesis and competing explanations

Target fault: intermittent internal primary-winding open in the cylinder-2 ignition coil. Alternative explanations: power-supply interruption, connector terminal intermittency, harness open/high resistance, missing or inadequate coil-driver switching, spark-plug and mechanical/fuel causes of P0302. A DTC and missing primary-current ramp identify a symptom, not the failed component.

## Truth table and conditions

Machine-readable authoritative **proposal**: `data/curriculum/aut250-ignition-truth-table.json`. Each observation distinguishes normal, fault-active and post-repair states. Core distinguishing evidence must be obtained under the **same reproduced fault condition**:
1. Supply available at the defined coil boundary while fault is active.
2. Switching command measured at a defined accessible test point with known topology; command alone does not verify load-driving capability.
3. Primary-current ramp intermittently absent at cylinder 2 while reference cylinder is normal.
4. Terminal/harness integrity verified under controlled fault-active conditions. Static continuity alone does not rule out an intermittent connection.
5. Isolated primary measured open **across its actual terminals while the defect occurs**. This observation provides the strongest component-specific evidence, assuming proper isolation, validated test method and correct coil architecture.
6. After a simulated replacement, primary current resumes and misfire does not recur under equivalent conditions.

Visual connector inspection is not a DVOM test. No vehicle-specific pin assignment, current amplitude, resistance threshold, dwell duration, waveform shape, or repair procedure is approved. Avoid actual high-voltage or live ignition testing based on this simulated exercise.

## Data provenance and grading

Manufacturer/technical sources indexed in `data/curriculum/aut250-literature-evidence.json` are citation-only with licensing pending. The truth table is our own **provisional model**, not a verbatim technical source or a manufacturer standard. Evidence of completed steps is not evidence of correct reasoning; evaluation requires instructor judgment. Keep `validated:false` and `assessmentEligible:false`. Do not connect the R2 proposal to Cline's assets until SME review, scenario-versioning, circuit safety and human review are complete.

## Required joint review decisions

- Confirm the proposed external-switching coil topology or replace it with a precisely diagrammed alternative.
- Define test boundary and simulated load conditions; distinguish control signaling from current carrying capacity.
- Determine credible methods to reproduce an intermittent winding open and exclude a harness intermittency without false certainty.
- Specify approved virtual probe/connection actions and safety cues.
- Define post-repair verification conditions and instructor acceptance examples.
- Require independent automotive SME sign-off and a new reviewed implementation PR for all engine/asset mapping changes.

The old R1 engine remains unchanged by this PR. Focused contract tests are in `tests/aut250-ignition-truth-table.spec.js`.
