# AUT-250 R1 — Fault discrimination review gate

**Status: developmental, formative-only, technical SME review required.** This change does not establish a verified internal coil failure, diagnostic accuracy, or acceptable real-vehicle test procedure.

The original R1 engine offered a missing primary current ramp on cylinder 2 and allowed immediate simulated coil replacement. A missing ramp alone cannot localize an intermittent open: coil windings, coil electrical connectors, harnesses, power supply and driver circuit remain candidates. The corrective change blocks simulated coil replacement until the event log contains observed DTCs, coil supply voltage, primary-ramp observation, coil driver command check, connector inspection, and harness continuity check, plus a free-text reasoned diagnosis. It does **not** automatically judge that diagnosis correct, or imply that performing six checks guarantees a justified repair.

New `TESTS` entries are *illustrative qualitative placeholders*, not OEM procedures or electrical specifications:

- `scope_coil_driver_command` (`oscilloscope`): command pulses observed; does not independently establish coil defect.
- `inspect_coil_connector` (`dvom`): no obvious damage in this fictional observation; cannot exclude intermittency.
- `inspect_harness_continuity` (`dvom`): continuity during static check; cannot exclude intermittent harness faults.

These entries require technical correction and safety validation: a visual connector inspection should not be represented as a measurement with a DVOM; appropriate component and harness isolation, de-energization, back-probing procedures, driver-command interpretation, and live/intermittent reproduction need engineering review. **Do not direct students to perform actual coil-primary or high-voltage testing based on this fixture.** Correcting instrument classification and measurement semantics should be done in a separate reviewed scenario-version change coordinated with the integration contract and Cline's visual assets.

The simulation still uses the original R1 ID/version and fixed repair outcome solely to avoid breaking current development fixtures. **This is not a claim of automotive content approval.** The repair gate is a *workflow-completeness requirement*, not a diagnostic-validity determination. Before any instructional release, choose whether the underlying fault is internal coil primary or connector/harness intermittent, define discriminating tests under realistic operating conditions, obtain documented SME sign-off, version the scenario, and update the UI contract and assessment evidence mapping.

No scoring, student grades, production endpoint, database storage or eligibility flag is introduced. Unit tests assert blocked premature repair, required reasoning, original event provenance and formative restrictions.
