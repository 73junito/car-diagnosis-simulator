# `docs/hero-cta.md` — Hero CTA Behavior Spec

Save this file to `car-diagnosis-sim/docs/hero-cta.md` and commit it on the HERO-001 branch.

---

```markdown
# Hero CTA — Behavior & UX Specification

**Issue:** HERO-001
**Milestone:** Homepage: Hero (Sprint 1)
**Status:** Draft — awaiting sign-off
**Last updated:** 2026-05-12
**Owner:** @product-owner

---

## 1. Decision log

| # | Date | Decision | Rationale | Decided by |
|---|---|---|---|---|
| 1 | 2026-05-12 | Primary CTA action is **demo-load** | Drives simulator engagement directly from the hero; scroll-only was too passive | @product-owner |
| 2 | 2026-05-12 | Fallback on loader error is **scroll to `#demo-section`** | Preserves forward momentum even when assets fail to load | @product-owner |
| 3 | 2026-05-12 | Scenario selector opens as a **modal**, not a new page | Keeps the user in context; avoids full navigation on landing | @product-owner |
| 4 | 2026-05-12 | Default scenario ID is `demo-default` | Lowest barrier to entry; no query param required | @product-owner |
| 5 | 2026-05-12 | Debounce threshold set to **300 ms** | Prevents duplicate loads on double-click without feeling sluggish | @a11y-owner |

---

## 2. CTA modes

The Hero CTA supports three mutually exclusive modes. Only one mode is active at a time, controlled by the `data-cta-mode` attribute on the button element.

| Mode | `data-cta-mode` value | Trigger condition | Primary action |
|---|---|---|---|
| **demo-load** | `demo-load` | Default; no query param | Load scenario via `loadDemoScenario("demo-default")` |
| **scroll** | `scroll` | `data-cta-mode="scroll"` explicitly set | Smooth-scroll to `#demo-section` |
| **open-scenario** | `open-scenario` | `?scenario=select` query param present | Open scenario selector modal |

---

## 3. Interaction flows

### 3a. Demo-load (default)

```
User clicks Hero CTA
  │
  ├─► Button: set aria-busy="true", disabled, show spinner
  │
  ├─► Call loadDemoScenario("demo-default")  ←── 300ms debounce guard
  │       │
  │       ├─[resolve]─► Hide spinner, restore button
  │       │              Call window.startSimulatorWithScenario(scenarioData)
  │       │              Move focus to .demo-container
  │       │              Emit hero_demo_load_success
  │       │
  │       └─[reject / timeout > 10s]─► Hide spinner, restore button
  │                                     Show aria-live="polite" error toast
  │                                     Scroll to #demo-section (fallback)
  │                                     Emit hero_demo_load_fail
  │
  └─► Emit hero_cta_click (fires immediately, before async work)
```

### 3b. Scroll

```
User clicks Hero CTA  (data-cta-mode="scroll")
  │
  ├─► Emit hero_cta_click  { mode: "scroll" }
  │
  └─► scrollToTarget("#demo-section")
        ├─► Apply scroll-margin-top = header.offsetHeight
        ├─► window.scrollTo({ behavior: "smooth" })
        ├─► Respect prefers-reduced-motion → instant jump if enabled
        └─► Move focus to #demo-section (tabindex="-1")
```

### 3c. Open scenario selector

```
User clicks Hero CTA  (?scenario=select)
  │
  ├─► Emit hero_cta_click  { mode: "open-scenario" }
  │
  └─► Open scenario selector modal
        ├─► Trap focus inside modal
        ├─► User selects scenario
        │     └─► Call loadDemoScenario(selectedId)  [→ flow 3a from resolve]
        └─► User dismisses modal
              └─► Return focus to Hero CTA button
```

---

## 4. Error & retry UX

| Condition | UI response | Recovery |
|---|---|---|
| Network failure | Error toast: "Couldn't load the demo. Try again." | Button re-enabled; user may retry |
| Timeout (> 10 s) | Same toast | Button re-enabled; scroll fallback fires |
| Invalid scenario ID | Console warning (silent to user) | Falls back to `demo-default` |
| Modal dismissed without selection | No error | Focus returns to CTA |

**Toast requirements:**
- Rendered in an `aria-live="polite"` region outside the button
- Auto-dismisses after 5 s
- Does not shift page layout (position: fixed or absolute)

---

## 5. Telemetry schema

All events are delivered via `window.analytics.track(eventName, properties)` using
`navigator.sendBeacon` for non-blocking delivery, wrapped in `try/catch`.
**No PII may appear in any payload.**

### 5a. Event inventory

| Event name | Fired when | Mode(s) |
|---|---|---|
| `hero_cta_click` | Button clicked (before async work) | all |
| `hero_demo_load_start` | `loadDemoScenario()` call begins | demo-load, open-scenario |
| `hero_demo_load_success` | Promise resolves | demo-load, open-scenario |
| `hero_demo_load_fail` | Promise rejects or times out | demo-load, open-scenario |

### 5b. Payload schema

All events share this base schema. Additional fields are noted per event.

```json
{
  "source":      "homepage",
  "mode":        "demo-load | scroll | open-scenario",
  "scenarioId":  "string | null",
  "page_variant":"string | null",
  "session_id":  "string (anonymous)"
}
```

`hero_demo_load_success` and `hero_demo_load_fail` also include:

```json
{
  "duration_ms": 1240
}
```

### 5c. Example payloads

**`hero_cta_click`** (demo-load mode)
```json
{
  "source":      "homepage",
  "mode":        "demo-load",
  "scenarioId":  "demo-default",
  "page_variant": null,
  "session_id":  "anon-8f3c2a"
}
```

**`hero_demo_load_success`**
```json
{
  "source":      "homepage",
  "mode":        "demo-load",
  "scenarioId":  "demo-default",
  "page_variant": null,
  "session_id":  "anon-8f3c2a",
  "duration_ms": 1240
}
```

**`hero_demo_load_fail`** (timeout)
```json
{
  "source":      "homepage",
  "mode":        "demo-load",
  "scenarioId":  "demo-default",
  "page_variant": null,
  "session_id":  "anon-8f3c2a",
  "duration_ms": 10004
}
```

**`hero_cta_click`** (scroll mode)
```json
{
  "source":      "homepage",
  "mode":        "scroll",
  "scenarioId":  null,
  "page_variant": null,
  "session_id":  "anon-8f3c2a"
}
```

---

## 6. Responsive breakpoints

| Breakpoint | Width | CTA behavior notes |
|---|---|---|
| Mobile | 320 px – 767 px | Full-width button; tap target ≥ 44 × 44 px |
| Tablet | 768 px – 1279 px | Centered, fixed width 280 px |
| Desktop | 1280 px+ | Centered, fixed width 320 px |

Scroll offset must account for sticky nav height at each breakpoint.

---

## 7. QA acceptance steps

### Manual checklist

- [ ] **Default load:** Open `/` with no query params → click CTA → spinner appears → demo loads → focus lands on `.demo-container`
- [ ] **Scroll mode:** Set `data-cta-mode="scroll"` on button → click CTA → smooth scroll to `#demo-section` → focus lands on section
- [ ] **Open-scenario mode:** Navigate to `/?scenario=select` → click CTA → modal opens, focus trapped inside → select a scenario → demo loads
- [ ] **Debounce:** Click CTA 5× within 200 ms → confirm exactly one `hero_demo_load_start` event in console
- [ ] **Error / timeout:** Block network → click CTA → error toast appears within 10 s → CTA re-enables → page scrolls to `#demo-section`
- [ ] **Reduced motion:** Enable OS "Reduce Motion" → click scroll-mode CTA → instant jump (no animation)
- [ ] **Keyboard — demo-load:** Tab to CTA, press Enter → same flow as click
- [ ] **Keyboard — scroll:** Tab to CTA, press Space → smooth scroll, focus moves
- [ ] **Telemetry:** Open DevTools console, mock `window.analytics.track` → verify all four event names fire with correct schema and no PII

### Automated test coverage

| Test file | Assertion |
|---|---|
| `tests/hero.spec.js` | Single loader invocation on rapid clicks (debounce) |
| `tests/hero.spec.js` | `aria-busy` present during load; removed on resolve/reject |
| `tests/scenario-loader.spec.js` | Resolves for `demo-default`; rejects on network failure |
| `tests/analytics.spec.js` | All four events fire; payload keys match schema; no PII |
| `tests/e2e/hero.playwright.js` | Focus lands on `.demo-container` after successful load |
| `tests/e2e/hero.playwright.js` | Scroll offset within `header.offsetHeight + 10px` |

Run all with:
```bash
npm test
```

---

## 8. Sign-off

| Role | Owner | Status | Date |
|---|---|---|---|
| Product / UX | @product-owner | ⬜ Pending | — |
| Accessibility | @a11y-owner | ⬜ Pending | — |
| Engineering lead | @eng-lead | ⬜ Pending | — |
| Analytics | @analytics-owner | ⬜ Pending | — |

_Post sign-off comment on HERO-001 and update this table before merging._
```

---

### Commit it in one command

```powershell
# From D:\\Car Diagnosis Simulator
New-Item -ItemType Directory -Force -Path "car-diagnosis-sim\\docs" | Out-Null
# (paste the markdown above into car-diagnosis-sim\\docs\\hero-cta.md, then:)
git add car-diagnosis-sim/docs/hero-cta.md
git commit -m "docs(hero): add Hero CTA behavior & UX spec (HERO-001)

Covers decision log, three CTA interaction flows, error/retry UX,
telemetry schema with example payloads, responsive breakpoints,
manual QA checklist, automated test coverage map, and sign-off table."
git push -u origin feat/hero-structure
```

The spec is fully self-contained — reviewers can sign off directly on HERO-001 without chasing context across multiple files. A solid follow-on would be generating the `js/hero.js` and `js/scenario-loader.js` stubs with JSDoc comments wired to this spec, so contributors have a ready-to-fill implementation skeleton the moment HERO-001 is signed off.

