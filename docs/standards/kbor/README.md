# Kansas Board of Regents Program Classification

## Purpose

TorqueMind / AutoLearnPro uses the Classification of Instructional Programs (CIP) taxonomy as the canonical academic-program classification layer for Kansas Board of Regents program alignment.

This classification establishes the curriculum context for diagnostic scenarios, assessment items, and learning objectives within the automotive technician training domain.

## Initial Supported Program

| Property | Value |
|----------|-------|
| State | Kansas |
| Authority | Kansas Board of Regents |
| Classification System | Classification of Instructional Programs (CIP) |
| Program Name | Automotive Technology |
| CIP Code | **47.0604** |
| CIP Title | Automobile/Automotive Mechanics Technology/Technician |
| Coverage | Brakes, electrical systems, engine performance, engine repair, suspension/steering, transmissions/drivetrains, heating/air-conditioning |

**Authority Reference**: [Kansas Board of Regents — Automotive Technology Program Alignment](https://kansasregents.gov/workforce_development/program-alignment/automotive_technology)

## Intended Curriculum Architecture

```
State (KS)
  └─ Authority (Kansas Board of Regents)
    └─ Program (Automotive Technology)
      └─ CIP Code (47.0604)
        └─ Credential / Program Level
          └─ Course
            └─ Competency (Technical Domain)
              └─ Learning Objective
                └─ Diagnostic Scenario
                  └─ Assessment Item (Question)
                    └─ Evidence
                      └─ Provenance (Citation)
```

## Design Principles

### 1. CIP Is the Initial Classification; Not the Only One

CIP 47.0604 is AutoLearnPro's first supported program classification. **It must not be implemented as the only possible CIP.**

The data architecture should permit:
- Additional programs and CIP codes (e.g., HVAC 47.0201, Collision Repair 47.0603)
- Additional states and regulatory authorities
- Multi-jurisdiction deployments

### 2. Separation of Concerns

**Curriculum Classification** (this layer) identifies the instructional-program context:
- What state? What authority? What program?
- What CIP code? What course? What competency?

**Evidence and Provenance** (existing layer) identifies the source basis for content:
- What source? What chunk? What citation? What validation?

These concerns should complement, not replace, each other.

### 3. Extensibility Without Redesign

The current scenario_catalog table has:
```sql
scenario_id TEXT PRIMARY KEY
title TEXT
description TEXT
active BOOLEAN
```

No curriculum fields are included in the current schema. This allows us to:
- Add curriculum metadata as a separate table or JSONB column
- Link scenarios to CIP competencies without modifying core scenario records
- Support multiple classification schemes (CIP, vendor-neutral technical standards, etc.)

### 4. Integration with Existing Provenance

The existing TorqueMind architecture includes:
- `approved_sources` (authoritative documents)
- `source_chunks` (extracted passages)
- `question_citations` (question → source mapping)
- `citation_validations` (proof of accuracy)

CIP classification should complement this by adding the *instructional context*. A traced assessment item should eventually carry:

```
Question
  ├─ CIP Classification
  │   ├─ CIP Code: 47.0604
  │   ├─ Course: [TBD]
  │   ├─ Competency: [TBD]
  │   └─ Learning Objective: [TBD]
  │
  └─ Evidence Provenance
      ├─ Source: [Document]
      ├─ Chunk: [Excerpt]
      ├─ Citation: [Reference]
      └─ Validation: [Proof]
```

## Current Status

- ✅ **CIP 47.0604** identified as primary program
- ✅ **KBOR alignment** documented and referenced
- ⏳ **Schema review** needed before database changes
- ⏳ **Curriculum metadata model** to be designed
- ⏳ **Course/competency linkage** to be implemented

## Next Steps

### 1. Schema Review (Next Phase)

Review the existing:
- `scenario_catalog` table
- `scenario_questions` table
- Any existing curriculum or competency references
- The full RALA provenance architecture

**Decision Required**: Where should CIP metadata live?
- Option A: Extend `scenario_catalog` with curriculum JSONB field
- Option B: Create separate `scenario_curriculum` lookup table
- Option C: Create `programs`, `courses`, `competencies` tables
- Option D: Other (to be proposed after schema review)

### 2. Curriculum Metadata Model (After Schema Review)

Define:
- How are scenarios mapped to technical competencies?
- How are technical competencies mapped to CIP competencies?
- What course structure should KBOR alignment follow?
- How should learning objectives be stored and linked?

### 3. Database Implementation (After Model Approval)

Only after schema review and model approval, create:
- Supabase migration(s)
- Seed data for KBOR course/competency structure
- Scenario-to-competency mapping
- Updated scenario router (if needed)

## Out of Scope

This PR establishes **documentation and classification reference only**.

**NOT included**:
- Supabase schema changes
- Database migrations
- Curriculum metadata in scenario_catalog or other tables
- Updates to question generation or routing logic
- Changes to existing provenance or evidence architecture

## References

- [Kansas Board of Regents — Program Alignment](https://kansasregents.gov/workforce_development/program-alignment)
- [KBOR — Automotive Technology (CIP 47.0604)](https://kansasregents.gov/workforce_development/program-alignment/automotive_technology)
- [KBOR — Other Supported Programs](https://kansasregents.gov/workforce_development/program-alignment)
- [National Center for Education Statistics — CIP Taxonomy](https://nces.ed.gov/ipeds/cipcode/)
