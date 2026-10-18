# Adapter compatibility — PR #1050 mock vs PR #1049 R1 engine (inspection only)

Date: 2026-10-18
Mock: `dashboard/student/aut250-lab-ui/aut250-mock-adapter.js`
Engine inspected read-only: `engine/aut250MisfireLab.js` on `origin/main`
Engine file was NOT modified, copied into this branch, or cherry-picked.

## Critical discrepancy: different simulated faults

- PR #1050 mock: cylinder 3 steady secondary-open fault.
  - `P0303` + `P0300`, MIL on.
  - Secondary resistance `OL (open)`.
  - Secondary scope pattern `missing-spark-line`.
  - Correct simulated repair: `replace-ignition-coil-cylinder-3`.
- PR #1049 R1 engine: cylinder 2 intermittent primary-open fault.
  - Scenario `AUT250-MISFIRE-CYL2-R1`, DTC `P0302`.
  - Scope observation `intermittent_missing_primary_current_ramp`.
  - Correct simulated repair: `cylinder_2_ignition_coil`.

Do NOT merge these scenarios or change expected readings without
automotive SME review.

## Method-by-method classification

| Area | Mock behavior | R1 engine behavior | Classification |
|---|---|---|---|
| Session creation | `session()` takes no arguments; Web Crypto ID with injectable `makeId` test override | `session({sessionId, studentAlias, clock})` validates pseudonymous identifiers | Requires an adapter translation |
| Generic event recording | `record(type, payload)` rejects closed sessions; supports `session-ended` | `record(kind, payload)` accepts only allowlisted kinds; rejects `measurement_observed`; rejects writes after `session_ended` | Requires an adapter translation |
| Diagnostic test call | `test(testId)` validates catalog ID; throws for unknown/closed | `test(testId, instrument)` requires matching instrument; unknown tests/instruments throw | Requires an adapter translation |
| Repair call | `repair(repairId)` validates catalog ID; unknown/closed throws; known incorrect repairs return success false | `repair(component)` only accepts `cylinder_2_ignition_coil`, otherwise throws | Requires an adapter translation |
| Repair verification | UI reports verification text immediately from repair result | R1 requires separate verification test, unavailable before repair | Requires an adapter translation |
| Evidence export | Local `{bundle, simulated, notForAssessment, sessionId, events, repairs}` | Versioned event array with schema/scenario IDs, sequence numbers, timestamps, copies, SHA-256 field | Requires an adapter translation |
| Session lifecycle | Close/end operation supported | `record('session_ended')` closes session; later writes throw | Requires an adapter translation |
| Fault identity | Cylinder 3 secondary open | Cylinder 2 intermittent primary open | Requires technical subject-matter review |
| Test identifiers | `scan-tool-dtc`, `coil-secondary-resistance`, `scope-ignition-secondary`, etc. | `read_dtc`, `measure_coil_supply`, `scope_coil_primary_2`, etc. | Requires an adapter translation |
| Instrument identifiers | Display categories only | Checked `scan_tool`, `dvom`, `oscilloscope` mapping | Requires an adapter translation |
| Measurement semantics | Secondary OL is the key finding | Primary intermittent ramp is the key finding | Requires technical subject-matter review |
| Error handling | Unknown repairs/tests and closed sessions throw | Unsupported tests, instruments, repairs, payloads, and premature verification throw | Requires an adapter translation |
| Assessment authority | Explicit `notForAssessment:true`, no score | Explicit `assessment_eligible:false`, `validated:false`, formative prototype | Compatible |
| Network/persistence | None; browser-local only | None; in-memory only | Compatible |
| Student identity | Random local `SIM-...` only | Caller-supplied pseudonymous alias, validated | Requires technical subject-matter review |
