# Automotive Circuit Lab: calculation UI integration plan

**Design only; not a runtime integration.** Upstream module: PR #1060 (`engine/circuitLabCalculations.js`), which must merge and pass all CI before implementation proceeds. Course context: AUT 250 Automotive Diagnostics I, proposed theoretical measurement outcome.

## Student interaction

1. Show a distinct **Ideal DC resistive circuit — theoretical example** with editable voltage (V) and resistance (ohm), assumptions, and visible units. Reject invalid input visibly; never substitute a guessed value.
2. On an explicit student action, call a reviewed browser-compatible calculation adapter. Display predicted current (A) and power (W), model ID and the illustrative—not OEM—notice.
3. Offer an **optional** measured-current field. Until supplied, show **not supplied**, not a fake measurement. After valid input, show signed measured-minus-predicted difference, absolute difference, and percent magnitude discrepancy (undefined when predicted value is zero). Do not label pass/fail or within specification.
4. Separate fields for manufacturer specification, source/vehicle applicability, instrument uncertainty and measurement conditions should default to **unverified / not supplied**. Never bundle fictitious OEM figures or cite an unverified limit.
5. Provide readable equations and results for keyboard and screen-reader users; never convey measurements solely through a dial or chart. State invalid reasons adjacent to inputs and announce result changes.
6. Allow a student to document model assumptions and whether the evidence supports, contradicts or is insufficient for a hypothesis. This is formative reasoning, not automatic grading.

## Architecture and technical controls

`engine/circuitLabCalculations.js` is standalone CommonJS and must be explicitly adapted to the client bundling strategy; no direct dependency on the diagnostic R1/R2 engine or its repair gate. Render the theoretical calculator as a separately labeled exercise; do not map arbitrary predicted values into Cline oscilloscope samples, scan-tool codes, or cylinder-2 ignition-coil truth states. Future instrumentation may consume separately verified experimental measurements through the existing asset provider contract, preserving `source.illustrative` and not-supplied semantics.

## Test acceptance

- 12 V / 6 ohm theoretical output is 2 A and 24 W; all values explicitly illustrative.
- Invalid, missing, infinite, and zero-resistance inputs are rejected without fallback.
- Missing workshop measurement remains unavailable; 0 predicted current has undefined percent difference.
- Signed discrepancy, units, and assumptions displayed correctly.
- No OEM-validity, high-stakes scoring, R2 ignition transient waveform, or production authorization invented.
- Keyboard and screen-reader behavior demonstrated; no accessibility claim based solely on unit tests.

**Implementation gate:** after PR #1060 merges and technical review confirms the UI adapter/educational framing, create a separate Cline-coordinated PR changing only the isolated calculator surface. Release, grading, and institution approval stay separate.
