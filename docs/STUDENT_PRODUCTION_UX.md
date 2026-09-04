# Student Production UX and Diagnostic Workflow

**Status:** Production behavior as of the 21-scenario catalog and legacy-entrypoint consolidation.

## Student Entry and Scenario Selection

```mermaid
flowchart TD
  LegacyRoot["/dashboard/student.html"] --> Redirect["Preserve query and hash"]
  LegacyNested["/dashboard/student/student.html"] --> Redirect
  Redirect --> Dashboard["/dashboard/student/"]

  Dashboard --> Grid["Scenario grid: 21 cards"]
  Grid --> Card["Scenario card"]

  Card -->|Preview Scenario button| Preview["In-panel scenario preview"]
  Card -->|Start Diagnostic link| Workflow["Canonical diagnostic route"]

  Workflow --> Route["?scenario=unique scenario_key"]
  Route --> Resolver["Resolve exact scenario"]
```

## Diagnostic Workflow

```mermaid
flowchart TD
  Start["Start Diagnostic"] --> Resolve["Resolve scenario_key"]
  Resolve --> Load["Load approved question bank"]
  Load --> Gate{"Validated questions available?"}

  Gate -->|No| Closed["Fail closed: unavailable state"]
  Gate -->|Yes| Mode{"Delivery mode"}

  Mode -->|Training| Question["Render question"]
  Mode -->|Assessment| Question

  Question --> Answer["Student submits answer"]
  Answer --> Grade["Server-side grading"]

  Grade -->|Training| Feedback["Show learning feedback"]
  Feedback --> Tutor{"AI tutor enabled?"}
  Tutor -->|Yes| Help["Grounded tutor support"]
  Tutor -->|No| Next["Next question"]

  Grade -->|Assessment| Restricted["Submitted only; no tutor or feedback"]
  Help --> Next
  Restricted --> Next

  Next --> More{"More questions?"}
  More -->|Yes| Question
  More -->|No| Summary["Attempt summary"]
```

## Contracts

- **Canonical student dashboard**: `/dashboard/student/` with 21-card scenario grid.
- **Legacy student URLs**: `/dashboard/student.html` and `/dashboard/student/student.html` redirect to canonical dashboard while preserving query parameters and hashes.
- **Diagnostic route**: `/dashboard/student/scenario/?scenario=<scenario_key>&mode=<training|assessment>` resolves via unique `scenario_key`.
- **Training mode**: Provides learning feedback after each answer and enables optional AI tutor support when enabled.
- **Assessment mode**: Submitted answers only; no tutoring, explanations, or answer keys exposed during the attempt.
- **Fail-closed availability**: Question availability remains blocked if approval or citation validation systems are unavailable.
