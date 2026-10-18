# AUT-250 engine/UI integration contract — R1

**Status:** Development-only compatibility specification; technical SME review pending. **No live UI connection, grading, assessment eligibility, research data capture, deployment, or institutional approval.**

## Canonical scenario choice

Use the engine's `AUT250-MISFIRE-CYL2-R1` identity as the canonical **integration target** only, not as a validated automotive diagnosis. Engine: intermittent cylinder-2 ignition coil primary open, P0302, supply voltage 13.8 V (illustrative), intermittent missing primary current ramp on scope, cylinder-1 normal comparison. The mock UI instead models cylinder-3 secondary-open, P0303/P0300, `OL` secondary resistance and secondary waveform; these cannot be translated by relabeling cylinder numbers or converting `OL` into a primary-current reading. An automotive SME must review scenario truth, electrical safety and realistic reading assumptions before use with students.

## Required implementation boundary (future integration PR)

- UI stays owned by Cline under `dashboard/student/aut250-lab-ui/**`; this PR changes **no UI or engine**.
- Create a *browser-safe*, explicit adapter implementation after review. The engine is currently CommonJS and uses `node:crypto`; do not call it from a browser with `require()`. Define trusted runtime and evidence checks before choosing browser bundling, server backend or a compatible port.
- Preserve the callable UI facade `session()`, `record(kind,payload)`, `test(testId)`, `repair(component)`, `exportEvidence()` as an interface goal, **not** a claim that the current implementations are interchangeable.
- Engine tests require `test('read_dtc','scan_tool')`, `test('measure_coil_supply','dvom')`, `test('scope_coil_primary_2','oscilloscope')`; verification uses a separate `test('verify_after_coil_replacement','scan_tool')` after `repair('cylinder_2_ignition_coil')`. Recording simulator-produced `measurement_observed` via public `record()` must remain forbidden.
- UI must explicitly label R1 measurements as **SIMULATED, illustrative, unvalidated**; show accessible text alternative to all scope traces and measurement units. Invalid actions may not imply success.
- Sessions need valid pseudonyms and lifecycle (`scenario_started`, hypotheses, test + simulator observation, diagnosis, repair, verification, `session_ended`). Unknown IDs and after-close writes fail closed.
- Evidence export must match `contracts/diagnostic-evidence/evidence.schema.json` and pass `validate()`; `evaluateEvidence()` remains formative-only and not an authenticity or student-identity verification system. A checksum alone does not secure provenance.
- Automated grading, instructor-research records and high-stakes use are out of scope. New human review requires a separate authorization path.

## Contract acceptance gates

1. SME accepts one fault model and expected measurements (or demands corrections in **another reviewed PR**).
2. Browser-safe implementation and dedicated UI-level integration tests match the selected engine scenario, including error paths and separate repair verification.
3. Native evidence is valid; mock/cross-scenario evidence is refused, not silently converted.
4. Accessibility, security/privacy, session identity, measurement provenance and instructor walkthrough are reviewed.
5. No automatic grade, pass/fail status or institutional validation claim.

Focus tests: `tests/institutional-pilot/aut250-engine-integration-contract.spec.js`. Current `checkCompatibility()` checks a *bounded core* of engine behavior and scenario identifiers; it is not comprehensive scientific validation.
