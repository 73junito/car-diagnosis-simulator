# Shared Attempt and Governance Architecture

## Status

Design baseline for unifying training scenarios, future assessments, and interactive labs without granting any new assessment eligibility. The Cloudflare Worker under `worker/` is the canonical production API runtime. The legacy `api/` tree remains migration-only until route parity and retirement are complete.

## Curriculum-to-delivery architecture

```mermaid
flowchart TD
    A["Syllabus Template Reference Library"] --> B["Curriculum Normalization"]
    B --> C["Program Architecture"]
    B --> D["Course Architecture"]
    B --> E["Learning Outcomes / Competencies"]
    B --> F["Lab Requirements"]
    B --> G["Assessment / Evaluation Requirements"]
    B --> H["Safety / Policy Requirements"]
    C --> C1["A.A.S. Automotive Technology"]
    C --> C2["Future Advanced Undergraduate Pathway"]
    C --> C3["Graduate Pathway"]
    D --> I["Course"]
    I --> I1["Modules"]
    I --> I2["Lessons"]
    I --> I3["Prerequisites"]
    I --> I4["Credit / Contact Hours"]
    E --> J["Competencies"]
    J --> J1["Knowledge"]
    J --> J2["Diagnostic Reasoning"]
    J --> J3["Measurement / Interpretation"]
    J --> J4["Documentation / Verification"]
    F --> K["Interactive Lab Layer"]
    K --> K1["Circuit Lab"]
    K --> K2["Sensor Lab"]
    K --> K3["Starting-System Lab"]
    K --> K4["Network Lab"]
    K --> K5["Relay / Load Lab"]
    K --> K6["Multivoltage Lab"]
    K --> K7["Actuator Lab"]
    I2 --> L["Learner Progression"]
    L --> L1["Explain System"]
    L1 --> L2["Demonstrate Check"]
    L2 --> L3["Guided Practice"]
    L3 --> K
    K --> L4["Diagnostic Scenario"]
    L4 --> L5["Explain Decision"]
    L5 --> L6["Feedback and Retry"]
    L6 --> L7["Document Verification"]
    L4 --> M["Scenario Engine"]
    M --> M1["Approved Question Loading"]
    M --> M2["Diagnostic Evidence"]
    M --> M3["Learner Response"]
    M --> M4["Server-Side Grading"]
    M --> M5["Training Feedback"]
    G --> N["Assessment Governance"]
    H --> N
    N --> N1["Content Approval"]
    N --> N2["Rights / Provenance"]
    N --> N3["Safety Review"]
    N --> N4["Technical Review"]
    N --> N5["Instructional Review"]
    N --> N6["Assessment Eligibility"]
    N6 --> O{"Delivery Mode"}
    O -->|Training| P["Training Controller"]
    O -->|Assessment| Q["Assessment Controller"]
    P --> M
    P --> K
    Q --> R["Server-Authoritative Attempt"]
    R --> R1["Authenticated Learner"]
    R --> R2["Attempt ID"]
    R --> R3["Assigned Question Set"]
    R --> R4["Assigned Lab / Fault State"]
    R --> R5["Audit Trail"]
    R --> R6["Server Finalization"]
    R3 --> M
    R4 --> K
    M --> S["Shared Learner UI"]
    K --> S
    S --> T["Progress / Completion Records"]
    R6 --> U["Sanitized Assessment Results"]
    T --> V["Instructor / Analytics Layer"]
    U --> V
```

## Runtime architecture

```mermaid
flowchart LR
    A["Course / Module"] --> B["Training"]
    A --> C["Assessment"]
    B --> D["Shared Learner UI"]
    C --> E["Server Attempt Controller"]
    E --> F["Attempt ID"]
    E --> G["Assigned Questions"]
    E --> H["Assigned Lab State"]
    F --> D
    G --> D
    H --> D
    D --> I["Scenario Engine"]
    D --> J["Lab Engine"]
    I --> K["Approved Question API"]
    I --> L["Server Grading API"]
    J --> M["Lab Runtime"]
    J --> N["Measurement / Action Events"]
    B --> O["Immediate Feedback / Retry"]
    C --> P["No Coaching During Attempt"]
    P --> Q["Server Finalization"]
    Q --> R["Assessment Result"]
    O --> S["Progress Record"]
    R --> S
    N --> S
```

## Runtime boundaries

- Scenario rendering may be shared between training and assessment, but assessment state must be server authoritative.
- Interactive labs keep their specialized simulation engines while sharing learner identity, attempt, governance, audit, and completion contracts.
- Training progress may remain browser-assisted where appropriate; assessment question assignment, lab configuration, scoring, and finalization must not depend on browser-local authority.
- Training approval does not imply scored, high-stakes, institutional, or production-assessment eligibility.
- The Worker routes are canonical for production. Legacy `api/` implementations must not be treated as the production security contract.

## Implementation status

The first server-authoritative binding layer is implemented by `20260928072000_add_assessment_attempt_question_binding.sql` and the Cloudflare Worker routes:

- assessment eligibility is a separate, empty-by-default registry;
- assessment attempts are created atomically with an immutable `attempt_questions` set;
- assessment-mode question delivery reads only the assigned set;
- grading rejects assessment questions that are not assigned to the attempt;
- assessment completion remains unscored in the browser until a server finalization route is implemented.
## Planned server-authoritative assessment contract

A future assessment attempt should bind the learner to an immutable server-selected set of questions and/or lab configuration. The intended data relationship is:

```text
attempts
  id
  user_id
  scenario
  delivery_mode
  status

attempt_questions
  attempt_id
  question_id
  sequence
  assigned_at

attempt_answers
  attempt_id
  question_id
  user_id
  student_answer
  is_correct
  submitted_at
```

Assessment finalization remains blocked until a separate implementation and governance approval establishes server-side completion and sanitized result release.