# No-Crank Candidate Technical Assessment Pending Human Confirmation

**Date**: 2026-09-01  
**Status**: AI-assisted candidate assessment (not human approval)  
**Database writes**: 0  
**Repository writes**: 0 (assessment documentation committed)  
**Ready for question generation**: NO (all passages require human confirmation)

---

## Summary of Decisions

| Passage ID | Source | Claim | Disposition | Technical | Instructional |
|---|---|---|---|---|---|
| discharged-battery-no-crank-p1 | Jump start 3997054 | Battery discharge → no-crank | **RECOMMEND APPROVAL** | ✓ Narrow | ✓ Suitable |
| low-voltage-starter-p1 | Mechanics 3251129 | Low voltage → starter power loss | **RECOMMEND APPROVAL** | ✓ Narrow | ✓ Suitable |
| automatic-park-start-p1 | Mechanics 3251129 | Automatic transmission Park instruction | **RECOMMEND APPROVAL** | ✓ Narrow | ✓ Suitable |
| clutch-interlock-p1 | Mechanics 3251129 | Clutch interlock on many manual vehicles | **RECOMMEND APPROVAL** | ✓ Narrow | ✓ Suitable |
| jump-start-procedure-p1 | Jump start 3997054 | Complete safe jump-start procedure | **RECOMMEND REJECTION** | ✗ Exceeds | ✗ Not Suitable |
| park-neutral-switch-diagnosis-p1 | Mechanics 3251129 | Diagnose Park/Neutral safety switch | **RECOMMEND REJECTION** | ✗ Exceeds | ✗ Not Suitable |

---

## Detailed Review

### ✓ CANDIDATE PASSAGE 1 — Discharged Battery No-Crank

**Source**: Wikibooks Automobile Repair/Jump start (oldid=3997054, line 6)  
**Proposed claim**: "A failed or discharged battery can prevent the engine from turning over when starting is attempted."

**Technical Assessment**: ✓ **ACCURATE AND NARROW**
- Claim is supported by electrical fundamentals: starter motor requires minimum voltage (typically 9.6V for 12V systems)
- Discharged battery is a legitimate no-crank cause
- Limitations properly stated: does not claim battery is the ONLY cause
- Does not overstep into complete jump-start procedures

**Instructional Assessment**: ✓ **SUITABLE FOR TRAINING**
- Establishes battery as one diagnostic pathway for no-crank
- Appropriate for step-by-step diagnostic reasoning
- Defensible within stated scope

**Assessment**: Assessment recommends approval pending human confirmation

---

### ✓ CANDIDATE PASSAGE 2 — Low Voltage Starter Power Loss

**Source**: Wikibooks Automobile Mechanics (oldid=3251129, line 18)  
**Proposed claim**: "Low battery voltage may leave the battery unable to operate the starter."

**Technical Assessment**: ✓ **DEFENSIBLE WITH QUALIFICATIONS**
- Accurately states the relationship: starter current draw requires minimum voltage
- Uses cautious language ("may") appropriate for electrical systems
- Limitations properly acknowledged: no specific voltage threshold provided
- Does not confuse battery state with circuit resistance

**Instructional Assessment**: ✓ **SUITABLE FOR DIAGNOSIS**
- Supports understanding of voltage requirements
- Prepares for voltage-testing procedures
- Establishes starting power as a diagnostic factor

**Assessment**: Assessment recommends approval pending human confirmation

---

### ✓ CANDIDATE PASSAGE 3: Automatic-Transmission Park Instruction

**Source**: Wikibooks Automobile Mechanics (oldid=3251129, line 4)  
**Proposed claim**: "The cited instructions direct the operator to place an automatic-transmission vehicle in Park before starting."

**Technical Assessment**: ✓ **NARROW PRECONDITION**
- States a procedural requirement, not a diagnosis
- Accurately reflects standard practice on automatic-transmission vehicles
- Does NOT attempt to diagnose a Park/Neutral safety switch failure
- Does NOT claim diagnosis methodology

**Instructional Assessment**: ✓ **SUITABLE AS PROCEDURAL STEP**
- Establishes a starting precondition
- Does not exceed source scope
- Limits claim to "the cited instructions direct"

**Assessment**: Assessment recommends approval pending human confirmation

**Important limitation**: This claim does NOT establish how to diagnose a failed Park/Neutral safety switch. It only documents the correct precondition for manual starting attempts.

---

### ✓ CANDIDATE PASSAGE 4 — Clutch Interlock on Manual Vehicles

**Source**: Wikibooks Automobile Mechanics (oldid=3251129, line 9)  
**Proposed claim**: "Many manual-transmission vehicles use a clutch switch that prevents starting unless the clutch is depressed."

**Technical Assessment**: ✓ **ACCURATE WITH QUALIFIER**
- Correctly uses "many" (not "all")
- Accurately describes clutch interlock function: switch activation gate for starter
- Qualifies as a legitimate starting precondition on affected vehicles
- Does not claim universality

**Instructional Assessment**: ✓ **SUITABLE FOR TRAINING**
- Explains a no-crank precondition on manual vehicles
- Supports diagnostic reasoning
- Properly scoped to manual transmissions

**Assessment**: Assessment recommends approval pending human confirmation

**Important limitation**: This claim does NOT provide a procedure for testing the clutch switch. It only documents the existence of this safety feature on many (not all) manual vehicles.

---

### ✗ CANDIDATE PASSAGE 5 (Recommended Rejection) — Complete Safe Jump-Start Procedure

**Source**: Wikibooks Automobile Repair/Jump start (oldid=3997054)  
**Proposed claim**: "Complete safe jump-start procedure."

**Technical Assessment**: ✗ **EXCEEDS SOURCE SCOPE**
- Wikibooks alone is insufficient for authoritative jump-start safety procedures
- Vehicle-specific precautions are not established in the captured revision
- Modern vehicles have supplementary safety considerations (hybrid, alternator-protection, computer interfaces) not addressed in general textbook content
- Current manufacturer specifications should govern jump-start procedures

**Instructional Assessment**: ✗ **NOT SUITABLE FOR SOLE RELIANCE**
- Jump-start safety has legal/liability implications
- Requires current vehicle-specific documentation
- Should reference manufacturer specifications or authoritative safety sources

**Approval**: **TECHNICAL_APPROVED = FALSE**, **INSTRUCTIONAL_APPROVED = FALSE**

**Rationale**: This claim attempts to use Wikibooks as the authoritative source for a safety-critical procedure. That exceeds the scope of community-authored content. Jump-start procedures require current, vehicle-specific, manufacturer-backed documentation.

---

### ✗ CANDIDATE PASSAGE 6 (Recommended Rejection) — Diagnose Park/Neutral Safety Switch

**Source**: Wikibooks Automobile Mechanics (oldid=3251129)  
**Proposed claim**: "Diagnose a defective Park/Neutral safety switch."

**Technical Assessment**: ✗ **CLAIM EXCEEDS CAPTURED EVIDENCE**
- The captured revision documents the REQUIREMENT for Park (procedural precondition)
- It does NOT provide a diagnostic methodology for a failed Park/Neutral safety switch
- Diagnostic procedures require test procedures, voltage expectations, circuit continuity methods—not present in the source

**Instructional Assessment**: ✗ **EXCEEDS SOURCE CONTENT**
- Making this claim would misrepresent what the source teaches
- Would violate CC BY-SA requirement to accurately represent source material
- Would create a false causal chain: "Park requirement → ability to diagnose switch"

**Approval**: **TECHNICAL_APPROVED = FALSE**, **INSTRUCTIONAL_APPROVED = FALSE**

**Rationale**: Per your guidance, the captured evidence does not support a general Park/Neutral safety-switch diagnosis. This claim would exceed the cited evidence. Wikibooks documents preconditions, not diagnostic procedures for safety-switch failures.

---

## CC BY-SA Compliance for Approved Passages

All four approved passages must include:

1. **Source attribution**: Full Wikibooks page title and URL
2. **Revision ID**: Permanent oldid reference (e.g., `oldid=3997054`)
3. **License statement**: "Shared under Creative Commons Attribution-ShareAlike 4.0"
4. **License link**: https://creativecommons.org/licenses/by-sa/4.0/
5. **Change disclosure**: Document any adapted wording
6. **ShareAlike obligation**: Derived questions must remain CC BY-SA compatible

---

## Constraints on Question Generation

### For Battery-Related No-Crank (Passages 1–2)
- ✓ May ask about battery voltage effects on starter operation
- ✓ May ask about discharged-battery symptoms
- ✗ Cannot ask about complete jump-start safety procedures (rejected)
- ✗ Cannot ask about jump-start sequence without additional authoritative source

### For Starting Preconditions (Passages 3–4)
- ✓ May ask about Park requirement on automatic transmissions
- ✓ May ask about clutch requirement on manual vehicles
- ✗ Cannot ask about diagnosing Park/Neutral safety-switch failures (rejected)
- ✗ Cannot ask about testing clutch interlock switches (exceeds source)

---

## Next Steps

1. **Formal Review**: Present these narrow decisions for stakeholder approval
2. **Question Draft**: Create sample questions based on approved passages only
3. **Ingestion Simulation**: Run rollback-only test with approved passages
4. **Citation Validation**: Verify all questions include required CC BY-SA attribution
5. **Deployment**: Only after formal approval of these narrow scopes

---

## Status Flags

- `review_status`: **`technical_review_complete`**
- `reviewer_approved`: **`false`** (human approval required before ingestion)
- `ingestion_allowed`: **`false`** (pending formal review and authorization)
- `database_writes`: **`0`**
- `repository_writes`: **`0`**

**Passages ready for question generation**: 4 approved (battery, voltage, Park, clutch)  
**Passages rejected**: 2 (jump-start procedure, safety-switch diagnosis)

## Approval boundary

This document records an AI-assisted candidate assessment. It is not a human
technical-review decision. All passages remain unapproved until an identified
human reviewer personally confirms the technical and instructional decisions.

- `human_technical_approved: false`
- `human_instructional_approved: false`
- `reviewer_approved: false`
- `ingestion_allowed: false`
- Supabase writes: 0

For conservative compliance, any question that adapts expressive Wikibooks
content will be distributed under CC BY-SA 4.0 with attribution, permanent
revision URL, license link, and an indication of changes. This is a project
policy and not a general legal conclusion about every fact-based question.
