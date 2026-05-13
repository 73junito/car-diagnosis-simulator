# Homepage — Hero CTA Issue Drafts

Below are 7 ready-to-create GitHub Issue drafts for the Homepage Hero CTA. Each section includes title, description, acceptance criteria, labels and milestone. You can create them with the `gh` CLI or paste into GitHub.

---

## Issue: Hero CTA — Define behavior & UX spec

**Description**
Decide and document the canonical behavior for the primary Hero CTA on the homepage: scroll to hero content, load a demo scenario inline, or open a scenario selector. Produce a short UX spec describing interactions, state transitions, and edge cases.

**Acceptance criteria**
- Add `docs/hero-cta.md` containing decision, rationale and interaction flows.
- Document CTA modes: `scroll`, `demo-load`, `open-scenario` with expected UI state for each.
- Define telemetry events and payloads for each outcome.
- Owner assigned and sign-off comment posted.

**Labels:** `enhancement`, `ux`, `docs`

**Milestone:** Homepage: Hero (Sprint 1)

---

## Issue: Hero CTA — Smooth scroll to anchor with sticky-nav offset

**Description**
Implement smooth scrolling behavior for the Hero CTA. When the CTA is set to scroll, it should navigate to the target region smoothly and account for the sticky navigation height.

**Acceptance criteria**
- `Start Demo` button triggers smooth scroll and lands focus on the target region.
- Sticky nav offset is handled (via `scroll-margin-top` or programmatic offset).
- Works on mobile and desktop; no visual layout jumps.
- Update `index.html` and add `js/hero.js` if missing.

**Labels:** `frontend`, `accessibility`

**Milestone:** Homepage: Hero (Sprint 1)

---

## Issue: Hero CTA — Demo scenario loader (core integration)

**Description**
Implement `loadDemoScenario(id)` that preloads assets, sets simulator state, and navigates the user into the demo flow when the CTA launches demo mode.

**Acceptance criteria**
- Add `js/scenario-loader.js` exporting `loadDemoScenario(id): Promise`.
- Preloads critical assets and resolves on success or rejects on error.
- Shows loading state while assets are fetched.
- On success, simulator state is initialized and UI enters demo mode.
- Include a simple unit test or harness that verifies `loadDemoScenario('demo-default')` resolves.

**Labels:** `frontend`, `backend-integration`, `testing`

**Milestone:** Homepage: Hero (Sprint 1)

---

## Issue: Hero CTA — Loading state & debounce

**Description**
Prevent double clicks and provide progress feedback while a demo loads. Add aria states and disable behavior until loading completes.

**Acceptance criteria**
- CTA uses `aria-busy` during load and displays a spinner or progress label.
- Button is disabled/debounced until `loadDemoScenario` resolves or rejects.
- On error, an accessible toast is shown and CTA is re-enabled.
- No duplicate scenario launches on rapid clicks.

**Files to update:** `index.html`, `js/cta-analytics.js` (or `js/hero.js`)

**Labels:** `frontend`, `accessibility`, `bug`

**Milestone:** Homepage: Hero (Sprint 1)

---

## Issue: Hero CTA — Track click analytics

**Description**
Add telemetry events for CTA usage: clicks, demo load start/success/fail, and entry source to the existing analytics pipeline.

**Acceptance criteria**
- Events emitted: `hero_cta_click`, `hero_demo_load_start`, `hero_demo_load_success`, `hero_demo_load_fail`.
- Events include properties: `source: 'homepage'`, `mode: 'scroll|demo|open'`, `scenarioId` (if applicable), `duration_ms`.
- Hook into existing analytics API (e.g. `window.analytics.track`).
- Add schema entry in `docs/telemetry.md`.

**Labels:** `analytics`, `backend-integration`

**Milestone:** Homepage: Hero (Sprint 1)

---

## Issue: Hero CTA — Keyboard accessibility & ARIA

**Description**
Ensure the CTA is keyboard operable and screen-reader friendly. Enter/Space must activate the action and focus must be managed correctly.

**Acceptance criteria**
- CTA is implemented as `<button>` or `role=\"button\"` with `tabindex` as necessary.
- Enter and Space trigger the action when focused.
- Proper `aria-label` provided when necessary.
- Focus moves to the next logical element after activation.
- Pass basic `axe` accessibility checks.

**Labels:** `accessibility`, `frontend`

**Milestone:** Homepage: Hero (Sprint 1)

---

## Issue: Hero CTA — Focus ring styling in `theme.css`

**Description**
Add or verify accessible focus styles for the Hero CTA using theme tokens so keyboard focus is clearly visible and consistent with the site theme.

**Acceptance criteria**
- Add CSS focus rule for `.btn-primary:focus` (or specific CTA selector) using `--tm-focus` tokens.
- Focus indicator has sufficient contrast and visible thickness.
- Works across major browsers and in keyboard-only navigation.
- Commit references updated token in `theme.css`.

**Files:** `theme.css`

**Labels:** `design`, `frontend`

**Milestone:** Homepage: Hero (Sprint 1)

---

### Optional: Create issues via `gh` CLI

Example command (create single issue using the existing file as body):

```powershell
gh issue create --title "Hero CTA — Define behavior & UX spec" --body-file .github/ISSUES/homepage-hero-issues.md --label ux,docs,enhancement --milestone "Homepage: Hero (Sprint 1)"
```

Or copy-and-paste each title/body into GitHub manually.

---

If you want, I can now:
- Create these issues using `gh` (requires network access) or
- Export CSV for bulk import into GitHub Projects, Linear or Jira.

Tell me which option and I'll proceed.
