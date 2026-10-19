# AUT 250 — diagnostic question and scenario authoring framework

**Developmental original examples only.** The three starter blueprints in `data/curriculum/aut250-obd-question-blueprints.json` cover OBD-I applicability, OBD-II evidence selection and an ideal resistive calculation with explicitly missing measurements. These are **not live examination questions**. They map to the planned AUT 250 Automotive Diagnostics I competency and the two proposed outcome IDs already in the curriculum.

## Authorship contract

Each future authored question requires: stable ID, protocol, system and vehicle/test applicability, Bloom level, original stem, answer options and single answer key or an instructor-reviewed written-reasoning evidence checklist, reasoned feedback, source-document identifier and exact page when a document supplied relevant context, technical-review state, rights-review state, and no assessment authority. Source citations indicate research provenance; they do not imply the reference is an OEM source. Do not reproduce wholesale third-party code tables, prose or proprietary procedures.

Diagnostic principles: DTC presence does not prove a failed component; give competing plausible causes, proper follow-up measurement selection, repair verification and a defensible **inconclusive** choice when evidence is insufficient. Never hallucinate workshop voltages, OEM thresholds or application-specific troubleshooting procedures. Link manufacturer-specific codes to verified vehicle/year, engine, and retrieval/test mode before finalizing.

## Review workflow

Author original item → map to course/outcome/competency → cite licensed or link-only source and technical applicability → independent automotive SME accuracy review → instructor question-quality/distractor review → accessibility and bias review → approved formative release decision. High-stakes grading and institutional pilot permissions are separate gates and remain closed.

The source-approval catalog remains under review in PR #1063. The question blueprints contain only source references, not imported PDF descriptions. Validator `scripts/validate-obd-question-blueprints.js` verifies structural traceability and fail-closed review flags; it **does not substitute for expert validity review**.

No runtime question bank, live student flow, production database, AI question generator or grading is modified.
