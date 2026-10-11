# Phase 8A — Domain-Wide UX Architecture & Design-System Baseline

**Status:** Audit / planning artifact. No code, tokens, stylesheets, or generated files were changed by this document.
**Scope:** Inventory every production UI surface of the AutoLearnPro domain (public site, learner portal, exam domain, instructor surfaces, institutional surfaces, reference library, administration), map each route to the proposed six-area architecture, separate purely visual work from missing functionality, and lock the design-system foundation decisions before any page-by-page redesign begins.
**Relationship to prior work:** `docs/redesign-architecture-audit.md` performed the concept-level audit and left a pending palette decision (its Section 6). This document (a) resolves that decision, (b) supplies the complete route-level inventory the concept audit summarized, and (c) freezes the functional boundaries that the Phase 2 analytics-role-gate work (`torquemind-api/index.js`, commit `761e00f3`) did **not** resolve.
**Branch policy:** `docs/phase-8a-ux-architecture-audit`. Never `main`. Docs-only.

---

## 0. Decisions resolved by this phase

| # | Decision | Resolution |
| --- | --- | --- |
| D1 | Scope | **Domain-wide**, not a public-site refresh. All six concept areas share one component system, one visual language, and role-specific navigation shells. |
| D2 | Palette (prior audit §6) | Adopt as canonical: Navy `#14233C` (primary/nav), Blue `#377DE0` (interactive), Teal `#26A889` (secondary interactive / verified), Surface `#F4F7FB`, Inter as interface font, 8px spacing system. Amber `#f59e0b` retirement is subject to a semantic-dependency check (see §3). |
| D3 | Accessibility target | Raise the repo standard from WCAG 2.1 AA (`design-language/accessibility.md`) to **WCAG 2.2 AA**, including contrast validation of every new token in hover/focus/disabled/error states. Status must never be color-only. |
| D4 | Core motif | The diagnostic-learning sequence becomes the domain-wide interaction language: **Understand concern → Gather evidence → Evaluate possibilities → Choose next test → Verify conclusion.** It must shape navigation, scenario UI, reference library, and marketing narrative identically. |
| D5 | Functional freeze | Redesign must not simulate capabilities that are not authorized or implemented. The concrete freeze list is §4 and is binding on all visual work in this phase. |

---

## 1. Complete surface inventory mapped to the six-area architecture

Inventory source: `git ls-files '*.html'` (64 tracked HTML entry points, excluding `dist/` and tests) plus the `theme/` component library and `design-language/` specs.

### Area 01 — Public website (`autolearnpro.com`)

| Surface | Path | Status |
| --- | --- | --- |
| Production homepage (canonical) | `public-site/index.html` + `homepage.js` + `styles.css` | Live. Own dark-navy token set (non-colliding per prior audit correction). |
| Legal / contact / accessibility | `public-site/{privacy,terms,contact}.html`, `public-site/accessibility/` | Live. |
| Institutional marketing page | `public-site/institutions/` | Live. Marketing only — not a portal. |
| Research-sources marketing page | `public-site/research-sources/` | Live. Marketing only — not the library UI. |
| Root duplicates | root `index.html`, `main_index.html`, `temp_home.html`, `contact.html`, `privacy.html`, `terms.html`, `dashboard_live.html`, `dashboard_test.html` | **Dev/scratch artifacts duplicating Area 01.** Deployment entry point is confirmed `public-site/`; root copies must be archived before redesign effort is spent (prior audit §3). |
| Concept gaps | About, How It Works, For Students/Instructors/Institutions, Help Center, interactive demo case | Net-new content/pages (visual + content; demo case is a build). |

### Area 02 — Student learning portal (`app.autolearnpro.com/dashboard/student/`)

| Surface | Path | Status |
| --- | --- | --- |
| Dashboard home | `dashboard/student/index.html` (+ legacy `dashboard/student.html`) | Live. Light token system (`theme/tokens.css`). |
| Scenario training | `dashboard/student/scenario/` | Live. Server-authoritative grading; the motif's primary surface. |
| AI coach | `dashboard/student/coach/` | Live. |
| Learning path / activity / transcript | `dashboard/student/{learning-path,activity,transcript}/` | Live. |
| Seven interactive labs | circuit, sensor, starting-system, network, relay-load, multivoltage, actuator labs under `dashboard/student/` | Live. Each has a dedicated CSS file; candidates for shared-token migration. |
| Reference library (student) | `dashboard/student/reference-library/` | Live (student entry to Area 05). |
| Symbol library | `dashboard/student/symbol-library/` | Live. |
| Legacy variants | `dashboard/student.html`, `dashboard/obd2*.html`, `dashboard/analytics.html`, root `dashboard_live.html` | Legacy/scratch; candidates for archival with Area 01 duplicates. |

### Area 03 — Instructor workspace (`dashboard/instructor/`)

| Surface | Path | Status |
| --- | --- | --- |
| Instructor home | `dashboard/instructor/index.html` | Live. Links to analytics. |
| Analytics dashboard | `dashboard/instructor/{analytics.html,analytics.js}` | **Live and wired to production `/api/analytics/students` (and cards) via `api/` Workers functions with Supabase auth.** Renders a student table. Governance gap, not a visual gap — see §4. |
| Live session | `dashboard/instructor/live-session.html` (+ legacy `dashboard/live-session.html`) | Live. Dark token page (`theme.css`) — migration candidate. |
| Session history | `dashboard/instructor/session-history.html` (+ legacy) | Live. |
| Research | `dashboard/instructor/research/` | Live. |
| Concept gaps | Classroom management, case assignment with due dates/attempt limits, structured assessment review, class-performance views | Net-new functionality (backend + UI). Values in any redesign mock must be labeled illustrative. |

### Area 04 — Institutional portal

| Surface | Path | Status |
| --- | --- | --- |
| Marketing page | `public-site/institutions/` | Live. |
| Backend | `worker/routes/institution-search.js`, migrations `add_institution_email_domains`, `add_student_institution_claims`, `tests/institution-search-route.test.js` | Backend exists. |
| Portal UI | — | **Does not exist.** Programs, cohorts, access control, org reporting, approval/credit claims are net-new. |

### Area 05 — Technical reference library

| Surface | Path | Status |
| --- | --- | --- |
| Student entry UI | `dashboard/student/reference-library/` | Live. |
| Public page | `public-site/research-sources/` | Live. |
| Backend | `worker/routes/curriculum-references.js`, `worker/routes/semantic-scholar-research.js`, migration `add_curriculum_reference_library.sql`, contract tests | Backend + validation exist. |
| Three-panel reference UI (filters / documents / source-permission at point of use) | — | Net-new UI per the concept; permitted-use and revision status must render real validation state, never decorative. |

### Area 06 — Platform administration / governance UI

| Surface | Path | Status |
| --- | --- | --- |
| Spec only | `design-language/dashboards/administrator.md` | No admin dashboard exists. User management, content review queues, audit history, configuration are net-new. |
| Authoring (adjacent) | `dashboard/author/` | Live; supports content workflow but is not an admin surface. |
| Governance backend | Evidence validators, `validate:evidence-approval`, `validate:compliance-authority`, citation validation, server-authoritative grading (`worker/routes/scenario-submissions-grade.js`) | Extant and binding; admin UI must expose, not replace, these controls. |

### Cross-cutting surfaces

| Surface | Path | Status |
| --- | --- | --- |
| Auth | `sign-in/{student,instructor,recover,update-password}`, `sign-up/{student,instructor}` | Live. |
| Assessment | `assessment/index.html`, `exam-site/` (catalog, courses AUT-250, exam, learning-path, lesson-plans, curriculum-standards, program-architecture) | Live read/catalog surfaces; assessment delivery fail-closed by governance. `assessment/index.html` still loads legacy dark `theme.css` — migration candidate. |
| Design system (code) | `theme/` — `tokens.css` (canonical), `layout.css`, `dashboard.css`, `navigation.js`, `shell.js`, components (buttons, cards, forms, tables, stat-card, scenario-card, progress-card, transcript-card, learning-path, coach-panel, timeline, filter-toolbar, hero-banner, training-mode-card, dashboard-shell) | Real library. **Reuse; do not rebuild.** |
| Design system (specs) | `design-language/` — colors, typography, spacing, elevation, motion, icons, principles, accessibility, golden-path, dashboard-patterns, components/, dashboards/, layouts/ | Existing spec baseline to be updated to D2/D3 values. |

### Token-system load map (measured)

- 14 tracked HTML pages load canonical `theme/tokens.css` (light system).
- 6 load legacy root `theme.css` (dark monolith): `assessment/index.html`, `dashboard/live-session.html`, `dashboard_live.html`, `dashboard_test.html`, `main_index.html`, `temp_home.html`.
- `public-site/` uses its own `styles.css` (independent dark-navy set, confirmed non-colliding).
- Remaining pages (labs, most student surfaces) use per-directory CSS that must be audited token-by-token during migration.


---

## 2. Visual vs. functional classification (binding for phase planning)

| Work item | Class | Notes |
| --- | --- | --- |
| Homepage redesign, new marketing pages | **Visual/content** | Area 01. |
| Token consolidation + palette adoption (D2) | **Visual, highest leverage** | Unlocks all later phases; touches `theme/tokens.css` values only, with contrast validation. |
| Migrating the 6 legacy `theme.css` pages to canonical tokens | **Visual** | One-concern branch; must not change behavior. |
| Lab/surface harmonization to shared components | **Visual** | No simulation-logic changes. |
| Role-specific navigation shells (Student/Instructor/Institution) | **Visual/IA** | Shells only; Institution shell ships with unavailable-state placeholders. |
| 5-step motif refactor of scenario UI | **UX model** | Uses existing coach/scenario components; no grading-path changes. |
| Classroom management, case assignment, assessment review | **Functional (net-new)** | Out of Phase 8A. Requires worker/API + Supabase work; separate branches later. |
| Institutional portal (Area 04 UI) | **Functional (net-new)** | Out of Phase 8A. |
| Three-panel reference library UI | **Functional (net-new)** | Out of Phase 8A beyond existing student entry. |
| Admin dashboard (Area 06) | **Functional (net-new)** | Out of Phase 8A. |
| Instructor→student ownership-scoped reporting | **Blocked (§4)** | Not merely net-new — gated on an authorization model that does not exist. |

---

## 3. Design-system foundation — token delta

Canonical source remains `theme/tokens.css` (single source of truth; enforced by `tests/design-token-contract.spec.js`). Phase 8A changes **values**, not architecture:

| Token | Current | Approved (D2) | Risk note |
| --- | --- | --- | --- |
| `--tm-primary` | `#0f3d5e` | Navy `#14233C` | Verify white-text contrast ≥ 4.5:1. |
| `--tm-primary-2` / interactive | `#145f8f`; public-site `#2f8cff` | Blue `#377DE0` | Verify contrast on white surfaces and as text. |
| Teal (new semantic) | none (cyan `#35d4e5` decorative) | Teal `#26A889` | Map carefully vs. existing green `--tm-success #15803d`; teal = secondary-interactive/verified, green stays semantic success. |
| `--tm-bg` | `#f5f7fb` | Surface `#F4F7FB` | Effectively unchanged. |
| `--tm-accent` | `#f59e0b` (amber, in both token files) | **TBD by dependency check** | Do not remove until search proves no semantic (progress/warning) dependency. |
| Font | Inter ✓ | Inter | Already compliant. |
| Spacing | 4/8/12/16/24/32/48/64 ✓ | 8px system | Already compliant; codify 8px base as the rule. |
| Accessibility target | WCAG 2.1 AA | WCAG 2.2 AA | Update `design-language/accessibility.md`; add focus/contrast requirements for new tokens. |

Deliverables of the foundation workstream (each its own branch, per one-concern-per-commit):
1. Token value PR (with contrast validation report).
2. `design-language/{colors,accessibility,spacing}.md` update to D2/D3.
3. Legacy `theme.css` page migrations (6 pages).
4. Shared component conformance audit for per-directory CSS (labs, student surfaces).

---

## 4. Functional-boundary freeze (binding on all Phase 8A visual work)

Confirmed topology: **Cloudflare Workers is the only production backend**; `torquemind-api` is an undeployed dev scaffold. Commit `761e00f3` gated the scaffold's five analytics routes behind `requireRole('teacher')` as defense-in-depth. This does **not** establish instructor→student authorization, and Phase 8A must therefore:

1. **No live student-level instructor reporting beyond what exists.** `dashboard/instructor/analytics.js` already calls production `/api/analytics/students` and renders a student table. Redesign of this surface must not expand data exposure, and any new class-performance/insight views must render **explicitly-labeled illustrative or unavailable states** — never simulated live data.
2. **Instructor→student ownership model remains blocked.** Until an ownership/authorization model exists and is tested, no new surface may present an instructor with learner data scoped only by "is teacher" as if it were governed per-classroom data.
3. **Assessment authorization stays closed.** Training approval ≠ assessment eligibility; redesigned assessment UI keeps correct answers out of client payloads and preserves the training/assessment separation.
4. **Institutional approval, credit, and accreditation claims stay separate** — the institutional shell is navigation-only until Area 04 is actually built.
5. **Evidence / source-rights status stays visible and governed.** Verified badges reflect real validation state, never decoration.
6. **No secrets in redesign mocks.** Inline Supabase anon (publishable) keys follow existing patterns; service-role keys remain server-side only.

---

## 5. Acceptance criteria for Phase 8A

- [x] Repository inspected; branch is not `main` (`docs/phase-8a-ux-architecture-audit`).
- [x] Every tracked HTML surface inventoried and mapped to the six-area architecture (§1).
- [x] Visual work separated from net-new functionality and from blocked work (§2, §4).
- [x] Palette decision from prior audit §6 resolved (D2); amber retirement flagged for dependency check.
- [x] Functional freeze list written and binding (§4).
- [ ] Foundation workstream branches scheduled per §3 (future work; not this document).

---

## 6. Explicitly out of scope of this document

- No colors, tokens, stylesheets, routes, worker code, or tests were changed.
- No page-by-page redesign has begun; this document authorizes the foundation workstream only.
- No claims are made about live traffic, performance, or analytics baselines.
- Mermaid blocks deliberately avoided (matches prior audit; avoids the `docs:mermaid` coverage/render contract).
