# No-Crank Technical Review Status

**Date**: 2026-09-01  
**Branch**: `feat/no-crank-open-evidence`  
**Commit**: `2aa50e2` (license clearance terminology established)

## Captured Candidates (License-Cleared, Not Approved)

Both Wikibooks sources have been captured as immutable revisions via permanent Wiki API endpoints. The captured artifacts remain in temporary storage for technical review.

### Candidate 1: Automobile Repair/Jump start
- **Source**: Wikibooks
- **Permanent URL**: https://en.wikibooks.org/w/index.php?oldid=3997054
- **Revision ID**: 3997054
- **License**: Creative Commons Attribution-ShareAlike 4.0
- **Content Size**: 15,253 bytes
- **Captured**: ✓ Yes (SHA-256 verified)
- **Status**: `technical_review_pending`
- **Reviewer Approved**: FALSE
- **Ingestion Allowed**: FALSE

**Relevance to No-Crank Diagnosis**:
- Jump-start procedures (battery testing and diagnosis)
- Battery voltage discussion
- Electrical system fundamentals
- Suitable for battery-related diagnostic questions

### Candidate 2: Automobile Mechanics
- **Source**: Wikibooks
- **Permanent URL**: https://en.wikibooks.org/w/index.php?oldid=3251129
- **Revision ID**: 3251129
- **License**: Creative Commons Attribution-ShareAlike 4.0
- **Content Size**: 26,660 bytes
- **Captured**: ✓ Yes (SHA-256 verified)
- **Status**: `technical_review_pending`
- **Reviewer Approved**: FALSE
- **Ingestion Allowed**: FALSE

**Relevance to No-Crank Diagnosis**:
- Battery voltage specifications
- Starter operation and function
- Park/Neutral safety switches
- Clutch interlock behavior
- Comprehensive technical coverage of no-crank topics

## Approval Boundary

**License clearance does NOT establish**:
- Technical accuracy
- Instructional suitability
- Evidence approval
- Permission to ingest into Supabase
- Automatic use in question generation

**License clearance DOES establish**:
- That the source may be evaluated under CC BY-SA 4.0
- That attribution and license compliance requirements are understood
- That the source is not blocked by copyright prohibition
- That technical review can proceed

## CC BY-SA 4.0 Compliance Requirements

When (and if) questions are derived from these sources:

### Attribution Requirements
1. Source title and URL (including permanent revision ID)
2. Explicit CC BY-SA 4.0 license link: https://creativecommons.org/licenses/by-sa/4.0/
3. Statement: "Shared under Creative Commons Attribution-ShareAlike 4.0"
4. Author/organization: "Wikibooks contributors"

### Modification Requirements
1. Changes must be disclosed
2. Derived content must remain under CC BY-SA or compatible license
3. No additional restrictions may be imposed
4. Sublicensing restrictions must be respected

### Derivative Work Implications
- Questions derived from CC BY-SA sources inherit the CC BY-SA license
- If used in a proprietary assessment system, the assessment system must also be CC BY-SA
- Alternatively, questions and sources must be clearly segregated with CC BY-SA status documented

## Gates Before Question Generation

The following gates must be passed before any questions are ingested:

### Gate 1: Technical Content Review ✓ Captured, ⏳ Pending Review
- [ ] Expert review of relevant passages for no-crank diagnostics
- [ ] Verification that content is factually accurate and complete
- [ ] Assessment of pedagogical suitability for training scenarios
- [ ] Identification of technically defensible excerpts

### Gate 2: CC BY-SA Compliance Determination ⏳ Pending
- [ ] Decision: How will CC BY-SA requirements be satisfied?
- [ ] Will questions be openly licensed or segregated?
- [ ] Will derived questions be marked with CC BY-SA status?
- [ ] Are there implications for the assessment system licensing?

### Gate 3: Passage Selection ⏳ Pending Technical Review
- [ ] Identify specific passages suitable for question generation
- [ ] Document the exact source text for each selected passage
- [ ] Create stable excerpts (quotations with revision IDs)
- [ ] Verify accuracy against permanent revisions

### Gate 4: Question Generation (Deferred Until Gates 1-3 Complete)
- [ ] Create model questions from approved passages
- [ ] Include full source attribution and revision ID
- [ ] Include CC BY-SA license statement
- [ ] Test deterministic citation validation

### Gate 5: Evidence Manifest Update ⏳ Pending
- [ ] Mark sources as `draft` (not `approved`)
- [ ] Record passage selections with revision IDs
- [ ] Document CC BY-SA compliance strategy
- [ ] Prepare rollback-only ingestion simulation

## Database and Repository Impact

- **Database writes**: 0 (temporary review only)
- **Repository writes**: 0 (artifacts remain in temp directory)
- **Committed changes**: Terminology correction only (commit `2aa50e2`)

## Next Steps

1. **Technical Review Handoff**: Share captured artifacts for expert review
2. **Passage Selection**: Identify technically defensible excerpts
3. **CC BY-SA Strategy**: Determine licensing implications for derived questions
4. **Human Approval**: Confirm suitability and compliance before ingestion
5. **Question Generation**: Create questions only after all gates pass

---

**Status**: ✗ NOT READY FOR QUESTION GENERATION  
**Reason**: Candidates remain unreviewed and unapproved. License clearance is prerequisite, not authorization.
