# AUT-250 R1 — Diagnostic laboratory technical prototype

**Status:** developer-only deterministic simulation fixture. Not a validated vehicle digital twin, not a production student interface, not a research study, and not approved for graded or high-stakes assessment. This PR does not enable any score, modify assessment eligibility, write to a database, or deploy anything.

## Scenario and expected diagnostic observations

Scenario ID `AUT250-MISFIRE-CYL2-R1` version `0.1.0`: rough running under simulated load with cylinder 2 misfire code P0302 and intermittent ignition-coil primary fault. The lab fixture exposes scan-tool DTC/freeze-frame evidence, fuel trims, battery supply measurement, cylinder 1 and 2 scope comparisons, and a simulated post-repair verification. These values are **illustrative, not validated OEM specifications**. A qualified automotive instructor/technician must review the fault's physical plausibility, alternative causes, tool readings, safety prompts and actual repair procedure before instructional approval.

## Observable events and boundaries

`engine/aut250MisfireLab.js` exports `SCENARIO`, `TESTS`, and an in-memory `session()` state machine. It records ordered `scenario_started`, `hypothesis_recorded`, `test_requested`, simulator-originated `measurement_observed`, `diagnosis_submitted`, `repair_selected`, `repair_verification_requested`, and `session_ended` events. Each event has schema version, scenario version, pseudonymous session identifier, sequential ordinal, timestamp, type and payload. Evidence exports copy the event array and include SHA-256 over JSON events for accidental integrity checks; this is **not** an authenticated signature or tamper-proof audit log.

Instrument/test mappings are checked. Repair verification is inaccessible until the simulated repair is selected. Student-submitted measurement events are rejected. The fixture holds no research consent, no grade, no competency score, no persistence and no student identity integration. Production systems must separately design authentication, access rules, source attestation, retention, idempotency, timezone handling and secure evidence storage.

## Instructor review and acceptance before integrating UI

Review vehicle and fault truth; establish expected measurement tolerances with units and operating conditions; challenge the scenario with multiple defensible test sequences and alternative hypotheses; review safe technician procedures; conduct accessibility and localization checks; run independent SME sign-off; define instructor double-scoring workflow; verify event completeness and anonymized export. A diagnosis must never be graded merely for selecting a certain sequence or using the fewest clicks.

## Reproduce

`node --test tests/aut250-misfire-r1.test.js`

Next PR should add an **opt-in internal instructor preview UI** and scenario-truth review records. No LMS, gradebook, research pilot or eligibility changes are authorized by this fixture.
