# Batch 1 Question-Bank Audit — No Crank

## Purpose

This document is the first governed review artifact for Batch 1 (five scenarios at a time). It audits the existing `no-crank` static bank before any question is promoted to an approved/graded state.

This audit **does not change assessment eligibility**. All existing no-crank questions remain draft/fail-closed until provenance, evidence, reviewer, citation-validation, and staging gates are complete.

## Current repository state

- Scenario/question-bank ID: `no-crank`
- Required questions for a normal graded attempt: **20**
- Static records currently present: **20**
- Explicitly approved static records: **0**
- Existing fail-closed behavior: preserved
- Existing approved-source registry in `data/approved-sources.json`: empty

## Technical-source candidates for evidence review

These sources are candidates for metadata/citation evidence only until rights and human technical review are recorded.

1. **Delco Remy — “Tech Tip: Diagnosing Starter Cranking Problems” (2023)**
   - Supports symptom-first diagnosis, battery testing first, starter-main-cable voltage-drop testing, click/no-crank control-circuit checks, and ring-gear inspection after starter diagnosis.
   - Public manufacturer technical guidance.
   - Candidate rights mode: metadata/link/citation only pending rights review.

2. **Delco Remy — Heavy Duty Troubleshooting Guide: Starting and Charging System Testing**
   - Supports starter-main-cable voltage-drop testing and control-circuit testing.
   - Provides a total main-cable voltage-drop criterion for the specific heavy-duty procedure; this value must not be generalized to every vehicle without context.
   - Candidate rights mode: metadata/link/citation only pending rights review.

3. **Fluke — “How to Check Starter Circuit Voltage Drop with a Multimeter”**
   - Supports using loaded voltage-drop testing to locate excessive resistance in starter cables/connections and includes safety setup.
   - Candidate rights mode: metadata/link/citation only pending rights review.

4. **Fluke — “Diagnosing Voltage Drops: Electrical Automotive Troubleshooting”**
   - Supports the relationship among excessive resistance, voltage drop, corrosion/loose connections, and weak/slow electrical operation.
   - Candidate rights mode: metadata/link/citation only pending rights review.

5. **Clore Automotive — Carbon-Pile Battery Load Tester instructions**
   - Supports the temperature-dependent 15-second battery load-test threshold; at 70°F (21°C), the chart uses 9.6 V as the minimum.
   - This source demonstrates why the existing 9.6 V question must state test conditions.
   - Candidate rights mode: metadata/link/citation only pending rights review.

## Question-by-question technical audit

| # | Question ID / topic | Audit disposition | Required correction or evidence condition |
|---:|---|---|---|
| 1 | `no-crank-battery-check-01` — Battery testing | **Revise, likely retain** | Replace absolute “first test” wording with an initial diagnostic check tied to the click/no-crank symptom. Evidence should support beginning with battery condition/connections before condemning the starter. |
| 2 | `no-crank-battery-voltage-01` — Battery state of charge | **Revise** | “12.6 V” requires battery chemistry, rested/open-circuit condition, temperature/context, and an approved source. Do not present as a universal value for all 12-V battery technologies. |
| 3 | `no-crank-battery-load-01` — Battery load testing | **Revise before approval** | The 9.6 V value is condition-dependent. State the specified load magnitude, duration, and battery temperature (for example, one-half the battery's CCA rating for 15 seconds at 70°F/21°C when using the cited tester procedure) or defer to the equipment/OEM specification. |
| 4 | `no-crank-voltage-drop-01` — Voltage-drop testing | **Retain with evidence** | Well-formed general concept. Evidence should support loaded voltage-drop testing as a method for locating excessive resistance in starter cables/connections. |
| 5 | `no-crank-terminal-corrosion-01` — Terminal corrosion | **Retain with evidence** | General concept is sound. Link the explanation to increased resistance/voltage loss rather than implying corrosion is the only cause. |
| 6 | `no-crank-ground-resistance-01` — Ground path | **Revise** | Replace “no-start” with cranking-specific language. A poor ground path can produce slow/no crank even when open-circuit battery voltage appears acceptable. |
| 7 | `no-crank-starter-relay-01` — Starter relay | **Revise for test safety** | Do not imply resistance/continuity measurement on an energized relay circuit. Prefer command voltage, voltage-drop, relay output, or an OEM-specified relay test procedure. |
| 8 | `no-crank-solenoid-voltage-01` — Solenoid control | **Revise** | “Near-battery voltage” may be reasonable but must be tied to the circuit design/OEM threshold. Avoid a universal numeric or pass/fail rule. |
| 9 | `no-crank-ignition-switch-01` — Start request | **Revise** | Avoid assuming a mechanical key-cylinder architecture. Reframe around a missing start request caused by a fault in the start-command path (switch/input/module/wiring as applicable). |
| 10 | `no-crank-park-neutral-01` — Safety interlocks | **Revise terminology, retain concept** | Use “park/neutral switch or transmission-range input, depending on design.” Preserve the safety-interlock concept. |
| 11 | `no-crank-clutch-interlock-01` — Clutch interlock | **Retain with design qualifier** | Valid for vehicles that use a clutch-start/interlock switch; state the design qualifier. |
| 12 | `no-crank-starter-current-01` — Starter current draw | **Revise** | Current draw must be interpreted with battery voltage, cranking speed, temperature, and OEM/starter specifications. Do not reduce the result to only “starter resistance or seized engine.” |
| 13 | `no-crank-seized-engine-01` — Mechanical engine check | **Replace** | “Attempt to rotate engine with starter while monitoring current draw” is not an appropriate quick proof that an engine is not seized. Replace with an OEM-safe mechanical-rotation/engine-mechanical verification question. |
| 14 | `no-crank-immobilizer-01` — Immobilizer/security | **Revise** | Some systems inhibit crank; others permit crank and inhibit fuel/ignition. Reframe to “may inhibit starter authorization depending on vehicle design,” and require vehicle-specific evidence. |
| 15 | `no-crank-wiring-diagram-01` — Wiring diagrams | **Retain** | Strong diagnostic-process question. Evidence should support use of the correct wiring diagram to identify power, ground, control, fuse, relay, connector, and module paths. |
| 16 | `no-crank-starter-pid-01` — Scan-tool data | **Revise** | Starter command/enable PIDs are not universal. Add “when supported by the vehicle/module” and avoid implying a specific PID name exists on every platform. |
| 17 | `no-crank-cable-inspect-01` — Cable inspection | **Retain with evidence** | Sound visual-inspection concept. Include cable/terminal condition, corrosion, damage, connection security, and heat damage where supported. |
| 18 | `no-crank-relay-bypass-01` — Relay bypass safety | **Retain as safety concept; revise wording** | Keep the warning against uncontrolled bypassing. Do not teach improvised bypass methods; direct learners to approved service procedures and preservation of safety interlocks/fusing. |
| 19 | `no-crank-post-repair-01` — Verification | **Revise** | Verify the original symptom is corrected and repeat relevant cranking/electrical checks. Do not require “no DTCs remain” universally; verify related faults according to the service procedure. |
| 20 | Un-ID’d record — Mechanical starter engagement | **Assign stable ID and revise** | Add a stable ID. Replace “most often caused by” with a supported diagnostic statement about possible pinion/drive/ring-gear engagement faults; avoid unsupported prevalence claims. |

## Audit result

- **Ready to approve unchanged:** 0
- **Retain concept but requires evidence and/or wording refinement:** 12
- **Requires material revision:** 7
- **Replace:** 1
- **Missing stable ID:** 1 record
- **Questions promoted to approved by this audit:** 0

The bank therefore has the correct *quantity* (20 records) but is **not yet production-ready as a governed 20-question bank**.

## Next implementation sequence

1. Create the revised 20-question `no-crank` draft set while preserving draft status.
2. Assign every question a stable ID and remove universal/vehicle-specific claims that are not evidence-backed.
3. Create candidate source metadata records with fail-closed rights status.
4. Map each revised question to one or more evidence claims.
5. Perform human technical review and source-rights review.
6. Create/verify provenance and citation records.
7. Run deterministic citation validation.
8. Verify the staging endpoint still returns zero graded questions until all approval gates pass.
9. Promote only fully reviewed/evidence-backed questions.
10. Confirm the live API returns exactly 20 approved `no-crank` questions before enabling the normal attempt flow.

## Batch 1 scope after No Crank

After this bank reaches the governed pattern, repeat the same workflow for:

1. `no-start`
2. `overheating`
3. `electrical-load`
4. `misfire`

No assessment-eligibility changes should be made merely to reach the target count.
