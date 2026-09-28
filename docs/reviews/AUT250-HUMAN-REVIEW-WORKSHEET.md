# AUT-250 Human Review Worksheet

**Package:** `aut250-human-review-package-20260927`  
**Question batch:** `aut250-training-batch-001`  
**Scope:** 20 training-only questions across six AUT-250 modules  
**Approval effect of this worksheet:** none

This worksheet is a human-review aid. Completing it does not by itself approve a question, source, citation, assessment, or release.

## Rights review

Reviewer name: Rafael Rodriguez  
Reviewer ID: rafael-rodriguez  
Qualification / authority reference: AutoLearnPro project owner / content-governance authority  
Review date: 2026-09-27

Confirm each item:

- [x] Source identity and ownership reviewed
- [x] Permitted use scope reviewed
- [x] Quote/excerpt storage rights reviewed
- [x] Metadata/link-only policy confirmed where applicable
- [x] Third-party material risk reviewed

Decision: **Pass with limitations**

Notes:  
Citation metadata, canonical links/DOIs, bibliographic facts, and project-authored summaries are permitted for this workflow. Do not ingest, chunk, redistribute, or directly reuse copyrighted source excerpts unless separately cleared. Metadata-only evidence must not be represented as excerpt verification, source-text hash verification, or rights clearance.

## Technical review

Reviewer name: Rafael Rodriguez  
Reviewer ID: rafael-rodriguez  
Qualification reference: Former automotive instructor with over six years of post-secondary automotive instruction; automotive/diesel technician background; retired Army heavy equipment repair leader/technician.  
Review date: 2026-09-27

Confirm each item:

- [x] Technical claims reviewed
- [x] Source applicability reviewed
- [x] Vehicle-specific boundaries preserved
- [x] No single clue is treated as root-cause proof
- [x] No universal service values/procedures introduced
- [x] Answer keys and explanations checked

Decision: **Pass with limitations**

Notes:  
The 20 questions remain conceptual training questions and do not authorize vehicle service procedures. Vehicle-specific voltages, thresholds, isolation steps, wait times, PPE requirements, test points, and procedures must come from applicable authoritative service information. A DTC, temperature reading, SOC/SOH estimate, communication fault, charging symptom, or other single observation cannot by itself establish component failure. Request → Measure → Compare → Correlate → Verify remains an AutoLearnPro project-authored diagnostic framework; external sources support underlying diagnostic principles but are not represented as the origin of that framework. Technical approval does not approve citations, rights, high-stakes assessment use, or production release.

## Instructional review

Reviewer name: Rafael Rodriguez  
Reviewer ID: rafael-rodriguez  
Qualification reference: Former post-secondary automotive instructor with over six years of experience teaching automotive systems, diagnostics, electrical/electronics, engine performance, climate control, brakes, drivetrain, suspension/steering, and transmission courses.  
Review date: 2026-09-27

Confirm each item:

- [x] Module alignment reviewed
- [x] Learning-objective alignment reviewed
- [x] Distractor quality reviewed
- [x] Explanation quality reviewed
- [x] Difficulty/progression reviewed
- [x] Training-only boundary is clear

Decision: **Pass with limitations**

Notes:  
The 20 items remain formative training questions, not institutional or high-stakes assessment items. Correct-answer feedback should continue emphasizing reasoning, uncertainty, evidence correlation, and vehicle-specific authoritative information. Distractors must not normalize unsafe service shortcuts, universal procedures, or component replacement from a single clue. Question difficulty may be recalibrated later using learner-performance data, but analytics must not substitute for technical or safety review. Instructional approval does not approve rights, citations, safety, production assessment use, or final release.

## Safety review

Reviewer name: Rafael Rodriguez  
Reviewer ID: rafael-rodriguez  
Qualification reference: Former post-secondary automotive instructor and automotive/diesel technician with experience teaching shop safety, electrical/electronics, diagnostics, and hands-on automotive laboratory procedures.  
Review date: 2026-09-27

Confirm each item:

- [x] High-voltage safety language reviewed
- [x] Vehicle-specific procedure boundaries reviewed
- [x] PPE and test-equipment language reviewed
- [x] No universal wait times or numeric thresholds introduced
- [x] No unsafe bypass or intrusive procedure is instructed
- [x] Feedback does not authorize unsafe service action

Decision: **Pass with limitations**

Notes:  
AUT-250 remains conceptual and training-focused; it does not replace manufacturer service information or workplace safety procedures. High-voltage isolation, discharge or wait times, PPE selection, meter category or rating, test points, and acceptance criteria must remain vehicle- or component-specific. No learner-facing item may instruct bypassing interlocks, defeating protection systems, probing energized high-voltage circuits without an approved procedure, or performing intrusive testing merely to answer a training question. Diagnostic feedback may recommend obtaining additional evidence, but it must not authorize component removal, high-voltage access, or repair based solely on the training response. Safety approval does not by itself approve citation validation, assessment eligibility, production release, or final question approval.

## Citation-evidence representation decision

**Current project preference:** Option B — Metadata-only citation proof, pending human rights/governance confirmation.

The project preference does **not** complete this gate. A human reviewer must still confirm the representation before deterministic validation may advance.

### Option A — Approved excerpt chunks
Use the existing `citation-validator-1.0` unchanged. Only excerpts with an affirmative storage/reuse rights basis may become approved source chunks.

### Option B — Metadata-only citation proof
Use the separate `scripts/validate-aut250-metadata-citations.js` preflight to verify source identity, DOI/URL syntax, bibliographic metadata, per-question source linkage, candidate-support status, and human-gate state without storing copyrighted excerpts. This preflight does not claim excerpt or source-text hash validation and does not write production citation validation records.

Confirmed option: **Option B — Metadata-only citation proof**  
Decision reviewer(s): Rafael Rodriguez  
Decision date: 2026-09-27  
Rationale: AUT-250 evidence remains metadata/link-only; no affirmative rights basis has been established for storing copyrighted source excerpts; the separate metadata-only validator preserves `citation-validator-1.0` semantics and avoids false excerpt/hash verification claims.

## Final release gate

All of the following must be complete before any later approval action:

- [ ] Rights review complete
- [ ] Technical review complete
- [ ] Instructional review complete
- [ ] Safety review complete
- [ ] Citation-evidence representation selected
- [ ] Deterministic citation validation completed under that representation
- [ ] Separate final approval action recorded

**Current state remains: draft / training-only / non-scored / not assessment-eligible.**
