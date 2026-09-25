# Academic Pathways Architecture

AutoLearnPro separates academic level from CIP classification. Undergraduate and Graduate are top-level pathways; each pathway then carries the relevant disciplinary CIP and downstream learning structure.

```mermaid
flowchart TD
  A[Academic Pathways] --> U[Undergraduate]
  A --> G[Graduate]

  U --> U47[CIP 47.0604<br/>Automobile / Automotive Mechanics<br/>Technology / Technician]
  U47 --> UC[Course]
  UC --> UK[Competency]
  UK --> UL[Lesson Plan]
  UL --> US[Diagnostic Scenario]
  US --> UQ[Assessment Item]
  UQ --> UE[Evidence and Provenance]

  G --> G15[CIP 15.0803<br/>Automotive Engineering<br/>Technology / Technician]
  G15 --> GA[Advanced Diagnostic Analysis]
  G15 --> GT[Vehicle Systems and Testing]
  G15 --> GC[Curriculum and Assessment Design]
  G15 --> GR[Applied Research]
  G15 --> GL[Technical Instructional Leadership]
```
## Curriculum data contract

The canonical curriculum layer lives in `data/curriculum/`:

- `academic-pathways.json` — academic level and program/CIP assignment
- `undergraduate-courses.json` — undergraduate course records
- `graduate-courses.json` — graduate course records
- `competencies.json` — course-linked competencies
- `lesson-plans.json` — competency-linked lesson plans
- `scenario-mappings.json` — live scenario-to-curriculum mappings

`data/scenario-curriculum.js` remains a browser compatibility layer for current scenario pages. `npm run validate:academic-pathways` verifies that the compatibility data and canonical curriculum contract remain aligned.
