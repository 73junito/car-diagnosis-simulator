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

Reviewer name: ____________________  
Reviewer ID: ____________________  
Qualification reference: ____________________  
Review date/time: ____________________

Confirm each item:

- [ ] Technical claims reviewed
- [ ] Source applicability reviewed
- [ ] Vehicle-specific boundaries preserved
- [ ] No single clue is treated as root-cause proof
- [ ] No universal service values/procedures introduced
- [ ] Answer keys and explanations checked

Decision: **Pending / Pass / Pass with limitations / Hold**

Notes:  
____________________________________________________________

## Instructional review

Reviewer name: ____________________  
Reviewer ID: ____________________  
Qualification reference: ____________________  
Review date/time: ____________________

Confirm each item:

- [ ] Module alignment reviewed
- [ ] Learning-objective alignment reviewed
- [ ] Distractor quality reviewed
- [ ] Explanation quality reviewed
- [ ] Difficulty/progression reviewed
- [ ] Training-only boundary is clear

Decision: **Pending / Pass / Pass with limitations / Hold**

Notes:  
____________________________________________________________

## Safety review

Reviewer name: ____________________  
Reviewer ID: ____________________  
Qualification reference: ____________________  
Review date/time: ____________________

Confirm each item:

- [ ] High-voltage safety language reviewed
- [ ] Vehicle-specific procedure boundaries reviewed
- [ ] PPE and test-equipment language reviewed
- [ ] No universal wait times or numeric thresholds introduced
- [ ] No unsafe bypass or intrusive procedure is instructed
- [ ] Feedback does not authorize unsafe service action

Decision: **Pending / Pass / Pass with limitations / Hold**

Notes:  
____________________________________________________________

## Citation-evidence representation decision

**Current project preference:** Option B — Metadata-only citation proof, pending human rights/governance confirmation.

The project preference does **not** complete this gate. A human reviewer must still confirm the representation before deterministic validation may advance.

### Option A — Approved excerpt chunks
Use the existing `citation-validator-1.0` unchanged. Only excerpts with an affirmative storage/reuse rights basis may become approved source chunks.

### Option B — Metadata-only citation proof
Use the separate `scripts/validate-aut250-metadata-citations.js` preflight to verify source identity, DOI/URL syntax, bibliographic metadata, per-question source linkage, candidate-support status, and human-gate state without storing copyrighted excerpts. This preflight does not claim excerpt or source-text hash validation and does not write production citation validation records.

Confirmed option: ____________________  
Decision reviewer(s): ____________________  
Decision date: ____________________  
Rationale:  
____________________________________________________________

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
