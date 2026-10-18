# AUT 250 — Proposed Curriculum Alignment Matrix

**Repository course identity:** AUT 250 is **Automotive Diagnostics I**, status **planned**, CIP 47.0604, not a renamed Engine Performance course. Existing competency: `ug-aut250-systematic-diagnostics` (planned) — organize diagnostic evidence from symptoms, scan data, codes, tests, and applicable information to justify and verify a systematic next step.

## Proposed measurable outcome
Evaluate engineering assumptions by comparing simulated diagnostic measurements with applicable manufacturer specifications and technical evidence to determine their validity, limitations, and suitability for a specific automotive diagnostic application.

The verb **evaluate** calls for criteria-based judgment. For a fictional scenario with no real vehicle identification, substitute the explicitly scoped activity objective: evaluate simulated measurements against documented circuit assumptions, comparison conditions and relevant technical evidence; conclude supported, unsupported or inconclusive. Do **not** represent fictional values as manufacturer specifications.

## Traceable learning/assessment crosswalk
Machine-readable matrix: `data/curriculum/aut250-outcome-alignment-matrix.json`.
Every row maps a student action to an activity, retained student evidence and a review criterion:
- Identify assumptions and operating conditions → assumption register.
- Locate/appraise sources → manufacturer-applicability statement; if none applies, say so.
- Compare measurements → normal/fault-active/post-repair comparison table.
- Evaluate alternatives and limitations → competing-cause reasoning.
- Defend the diagnostic decision → evidence-based report with an inconclusive option.

Four-level **illustrative** analytic ratings (0–3) are descriptive only. No proficiency threshold, automated scoring, grade weighting, or assessment authority has been established; human instructor review and rubric validation remain required.

## External alignment and provenance
Industry engine-performance task frameworks, Kansas automotive course competencies, and engineering-technology outcome concepts are candidate mappings **only**. No task codes, Kansas state approval, or accreditation claim is asserted. Program mapping must be reviewed against current official source editions and program-specific approval criteria. AUT 250's source catalog and planned competency are the only verified local IDs.

The cylinder-2 R2 ignition-coil truth table is currently proposed in [PR #1056](https://github.com/73junito/car-diagnosis-simulator/pull/1056), not an approved engine release. This matrix references the proposed scenario ID; do not turn that into an operational runtime dependency or implied scenario validity.

## Future exit gates
Document SME technical sign-off, standards task-level crosswalk verification, manufacturer-specific applicability when invoked, inter-rater assessment evidence/reliability, institution-specific pilot approval, and separate high-stakes decision authorization. All presently false.

This PR is documentation/data/test-only and does not alter curricula served to students, scoring, engine, UI, access rights, storage, or deployment.
