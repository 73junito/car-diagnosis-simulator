# Car Diagnosis Simulator Architecture Summary

## Project Overview

Car Diagnosis Simulator is a web-based automotive diagnostic training platform.

Primary goals:

* Student diagnostic simulations
* ASE-aligned training scenarios
* Instructor analytics
* Telemetry collection
* Progress tracking
* Playwright and Jest validation

---

## Core Layers

### Frontend

Primary files:

* dashboard/student.html
* dashboard/student.js
* dashboard/student.css
* dashboard/analytics.html
* dashboard/analytics.js

Responsibilities:

* Scenario discovery
* Student dashboard
* Progress tracking
* Analytics display
* Session management

---

### Diagnostic Engine

Location:

* core/diagnosis/

Components:

* artifactParser.js
* graphModel.js
* inference.js
* ruleEngine.js

Responsibilities:

* Symptom analysis
* Diagnostic reasoning
* Rule evaluation
* Decision tree execution

---

### APIs

Location:

* api/

Major areas:

* auth/
* telemetry/
* analytics/
* attempts/

Responsibilities:

* Authentication
* Telemetry ingestion
* Student progress persistence
* Analytics aggregation

---

### Telemetry

Location:

* lib/telemetry/
* api/telemetry/

Responsibilities:

* Event capture
* Storage
* Export
* Historical analysis

---

### Testing

Unit Tests:

* tests/unit/

Playwright:

* tests/playwright/

Integration:

* tests/

Requirements:

* No failing tests
* No flaky selectors
* Dashboard functionality validated

---

## Architectural Principles

* Small modules
* Testable functions
* Minimal global state
* Clear API boundaries
* CI-first development
* Prefer maintainability over cleverness

---

## AI Agent Guidance

Before proposing changes:

1. Identify affected subsystem.
2. Identify existing tests.
3. Avoid breaking dashboard workflows.
4. Preserve telemetry compatibility.
5. Recommend new tests when functionality changes.
