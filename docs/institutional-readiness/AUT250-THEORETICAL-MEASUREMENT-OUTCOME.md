# AUT 250 — theoretical automotive measurement evaluation outcome

**Course identity:** Automotive Diagnostics I, planned. **Status:** proposed curriculum addition, not pilot authorization or grading approval.

## Complementary learning outcome

Calculate and evaluate theoretical automotive system values by comparing predicted results with applicable manufacturer specifications and measured data, identifying discrepancies, explaining their causes, and assessing the validity of the underlying assumptions.

This **supplements, rather than replaces**, the existing engineering-assumptions evaluation outcome in `data/curriculum/aut250-outcome-alignment-matrix.json`. It maps provisionally to `ug-aut250-systematic-diagnostics`. Bloom levels: Apply, Analyze, Evaluate.

## Suggested student deliverables

1. Select and justify an engineering model and define its assumptions, units and operating conditions.
2. Show the theoretical calculation with units and traceable inputs.
3. Identify whether manufacturer specifications apply to the actual system, or explicitly record their absence.
4. Compare prediction with independent measured evidence **only when supplied**.
5. Interpret discrepancies, uncertainty, and plausible alternative causes; an inconclusive finding is acceptable.
6. Defend a next diagnostic step in an instructor-reviewable report.

Illustration: ideal 12 V resistive source with 6-ohm constant load predicts 2 A and 24 W. This is an explicitly fictional steady-state model. **No workshop reading or OEM value is asserted.** A switched ignition-coil primary is an RL transient and must not inherit those 2 A/24 W values. The RL example remains uncalculated until resistance, inductance, control architecture, drive conditions, and SME-reviewed evidence are provided.

## Review and governance

Machine-readable proposed alignment: `data/curriculum/aut250-theoretical-measurements-outcome.json`. Do not infer a passing score or automatic grading from the illustrative evidence criteria. Manufacturer compliance, measured accuracy, rubrics, institution adoption, and external standard crosswalk remain unapproved. No curriculum runtime, diagnostic engine, asset visualizer, telemetry, persistence or deployed assessment logic is modified by this change.

The separate R2 design PR #1058 addresses future interface compatibility; this change is a curriculum-only proposal.
