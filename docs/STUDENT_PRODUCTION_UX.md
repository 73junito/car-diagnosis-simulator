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

  Card -->|Card background| Preview["In-panel scenario preview"]
  Card -->|Start| Workflow["Canonical diagnostic route"]

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

- The canonical student dashboard is `/dashboard/student/`.
- Legacy student URLs redirect while preserving query parameters and hashes.
- Scenarios resolve through a unique `scenario_key`.
- Training feedback and AI tutoring are mode-dependent.
- Assessment mode does not expose tutoring, answer explanations, or answer keys during an attempt.
- Question availability remains fail-closed when approval or citation validation is unavailable.
