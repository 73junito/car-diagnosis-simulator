# Render & Test Contract

## Purpose

This document defines the rendering pipeline, testing strategy, and invariants for the Student Dashboard and Scenario Registry systems. It captures the contract between the UI, the normalized scenario data, and automated tests (Jest unit tests and Playwright E2E). Use this as the canonical guide when changing rendering behavior or test expectations.

---

## Render Pipeline

### 1. Scenario Registry
- **Input**: `window.scenarios`
- **Output**: `window.SCENARIO_REGISTRY`
- **Invariants**:
  - Every scenario has a unique `id`.
  - Titles are normalized and predictable.
  - Images are normalized (placeholder used when missing).
  - Registry entries are stable and deterministic between loads.

Source: `data/scenario-registry.js`

---

### 2. Filter Collection
- **Function**: `getFilters()`
- **Input**: Search input, Category selector, Difficulty selector, ASE selector
- **Output**:
```json
{ q, category, difficulty, ase }
```
- **Invariant**: Pure UI state read — this must not mutate the registry.

---

### 3. Filter Evaluation
- **Function**: `matchesFilter(s, filters)`
- **Input**: scenario `s`, filter object
- **Output**: boolean
- **Invariant**: Deterministic and side-effect free.

---

### 4. Dashboard Rendering
- **Function**: `renderDashboard()`
- **Responsibility**: Coordinate the rendering lifecycle and delegate DOM work to `renderGrid()`.

---

### 5. Grid Rendering
- **Function**: `renderGrid()`
- **Input**: filtered scenarios
- **Output**: populated `#scenarioGrid`
- **Invariant**: DOM card count equals filtered scenario count at the moment `grid:rendered` is signaled.

---

### 6. Card Creation
- **Function**: `createCard(s)`
- **Output**: `.sd-card` DOM element
- **Required Attributes**: `data-scenario-id` must be present and equal to the registry `id`.
- **Invariant**: UI identity equals registry identity.

---

### 7. Render Completion Signal
- **Mechanism**: `requestAnimationFrame` followed by dispatching the `grid:rendered` event on `window`.
- **Invariant**: `grid:rendered` must be emitted only after DOM insertion and paint scheduling so tests reliably observe the painted DOM.

---

## Test Strategy

This project uses a layered testing strategy: fast unit tests (Jest) for pure logic and deterministic modules, and Playwright E2E for behavioral contracts and UI-level invariants.

### Playwright (E2E)

- **Smoke**
  - Initial render and registry parity (full dataset render)
  - Basic interactions
  - Mobile overflow checks

- **Filter**
  - Search filtering and focused subset assertions (e.g. `no-crank` → 2 matches)

- **Reset**
  - Empty-state behavior and Reset button restores baseline

- **Accessibility**
  - Keyboard navigation: Enter/Space to open detail, Escape to close, focus restoration

Tests must always wait for `grid:rendered` before reading `#scenarioGrid`.

### Jest (Unit)

- **Registry tests**: Unique IDs, title fallback, image fallback, difficulty normalization.
- **Filter tests**: `matchesFilter()` matrix covering empty, search, category, difficulty, ASE, and combined filters.
- **Diagnostic engine tests**: evidence application, useTool behavior, scoring and diagnosis evaluation for correct/incorrect/edge cases.

Unit tests should be the first line of defense for logic that does not require a browser environment.

---

## Core Invariants

1. Registry IDs are unique.
2. DOM card `data-scenario-id` values match registry IDs.
3. Filtering is deterministic (pure function behavior from `matchesFilter`).
4. `grid:rendered` occurs after DOM insertion and paint scheduling.
5. E2E assertions execute only after `grid:rendered`.
6. Diagnostic engine behavior is covered by unit tests.

---

## Maintenance Rules

When modifying these files:

- `dashboard/student.html`
- `dashboard/student.js`
- `data/scenario-registry.js`
- `engine/diagnosticEngine.js`

Run the test suite before commit and push:

```bash
npx jest tests/unit --runInBand
npx playwright test tests/playwright --trace on
```

Do not change rendering entrypoints or remove `data-scenario-id` attributes without adding equivalent tests that assert the new contract.

---

## Testing Responsibilities

- Playwright: verify UI contracts (counts, identity parity, empty states, reset flow, keyboard accessibility).
- Jest: lock down pure functions and business logic (filtering, registry normalization, diagnostic scoring).

---

## Appendix: Quick Contract Map

```
SCENARIO_REGISTRY
        ↓
getFilters()
        ↓
matchesFilter()
        ↓
renderDashboard()
        ↓
renderGrid()
        ↓
createCard(data-scenario-id)
        ↓
#scenarioGrid DOM
        ↓
requestAnimationFrame
        ↓
grid:rendered
        ↓
Playwright assertions
```

---

This file documents the agreed contract for rendering and testing the Student Dashboard. Keep it updated when any of the steps above change.
