# AutoLearnPro Redesign — Architecture Audit

**Status:** Audit / analysis artifact. No code, tokens, or generated files were changed by this document.
**Scope:** Evaluate the proposed "AutoLearnPro redesign concept" against the *actual* repository state and separate (a) visual redesign, (b) already-supported functionality, and (c) functionality that does not yet exist.
**Branch policy:** This audit lives on a feature branch, never `main`. It changes no runtime files.

---

## 0. Executive summary

The proposed concept is directionally sound and, importantly, **it is largely consistent with a design intent that already exists in this repository.** TorqueMind *is* AutoLearnPro; the platform described in the concept (public site, student portal, instructor workspace, institutional portal, reference library, administration) maps onto real directories that already exist or are partially built.

The single most important finding is a **design-token conflict**: the repository already ships **three different color systems**, and the concept proposes a fourth. A redesign that simply adds the proposed palette on top would *fragment* the product rather than unify it. The correct first move is therefore **token consolidation**, not new-palette adoption.

Recommended sequencing (aligned to the concept's own phased roadmap):

1. **Foundation (highest priority, lowest risk):** consolidate the three existing token sets into one canonical set, then decide whether to adopt the concept's proposed Navy/Blue/Teal values as that canonical set.
2. **Public site refresh:** mostly visual; infrastructure already exists.
3. **Student experience refinement:** mostly present; refine, don't rebuild.
4. **Instructor / institutional / admin:** the largest genuine *functional* gaps live here.
5. **Validation:** accessibility, permission, and source-workflow verification.

---

## 1. What already exists (preserve these)

| Concept area | Repository reality | Verdict |
| --- | --- | --- |
| Design system (docs) | `design-language/` — colors, typography, spacing, elevation, motion, principles, components (buttons, cards, forms, tables, badges, alerts, dialogs, navigation, progress, timeline, charts), and dashboard specs for student / instructor / administrator / analytics | **Strong asset. Preserve and promote to source of truth.** |
| Design system (code) | `theme/` — `tokens.css`, `layout.css`, `dashboard.css`, `components/css/*` (buttons, cards, forms, tables), plus JS components (scenario-card, stat-card, learning-path, coach-panel, progress-card, transcript-card, timeline, filter-toolbar, hero-banner) and a `dashboard-shell/` | **Real component library. Reuse; do not rebuild.** |
| Public website | `public-site/` — `index.html`, `accessibility/`, `institutions/`, `research-sources/`, `contact.html`, `privacy.html`, `terms.html`, `styles.css`, `sitemap.xml`, `homepage.js` | **Present.** Covers concept sections 01 (public) and part of 05 (references). |
| Student learning portal | `dashboard/student/` — `index.html`, `learning-path/`, `scenario/`, `coach/`, `activity/`, `transcript/`, and 7 labs (circuit, sensor, starting-system, network, relay-load, multivoltage, actuator) | **Present and functional.** Matches concept section 02. |
| Instructor workspace | `dashboard/instructor/` — `index.html`, `analytics.html`, `live-session`, `session-history`, `research/` | **Partially present.** Core exists; richer assessment/classroom tooling does not. |
| Authoring | `dashboard/author/` — `index.html`, `templates.js`, `author.css/js` | **Present** (supports content workflow). |
| Sign in / sign up | `sign-in/{student,instructor,recover,update-password}`, `sign-up/{student,instructor}` | **Present.** Matches concept "Sign In / Create Account". |
| Technical references (backend) | `worker/routes/curriculum-references.js`, `public-site/research-sources/`, Supabase migration `add_curriculum_reference_library.sql`, `tests/curriculum-reference-library-contract.test.js` | **Backend + public page exist.** The three-panel in-app reference UI does not. |
| Institutional search (backend) | `worker/routes/institution-search.js`, migrations `add_institution_email_domains`, `add_student_institution_claims`, `tests/institution-search-route.test.js` | **Backend exists.** Institutional *portal UI* does not. |
| Evidence / governance | Extensive validators: `validate:evidence-approval`, `validate:compliance-authority`, `validate:external-technical-references`, server-authoritative grading (`scenario-submissions-grade.js`), citation validation | **Core product differentiator.** Must not be weakened by any redesign. |

**Conclusion:** The concept is closer to a *refinement and unification* than a greenfield redesign. Sections 01, 02, and much of 03 already exist.

---

## 2. CRITICAL FINDING — three conflicting token sets (resolve first)

The repository already contains three mutually incompatible color systems. Each stylesheet defines the same semantic variable names (`--tm-bg`, `--tm-accent`, …) with **different values**, so the rendered color depends on which file a page loads.

| Source file | Theme | Background | Primary | Accent |
| --- | --- | --- | --- | --- |
| `theme/tokens.css` | **Light** | `#f5f7fb` | `#0f3d5e` (navy) | `#f59e0b` (amber) |
| `theme.css` (root) | **Dark** | `#0b1117` | (uses `--tm-panel` `#111827`) | `#f59e0b` (amber) + `#38bdf8` |
| `public-site/styles.css` | **Dark navy** | `#07111f` | — | `#2f8cff` blue / `#35d4e5` cyan |
| **Concept proposal** | Hybrid | `#F4F7FB` surface | `#14233C` navy | `#377DE0` blue / `#26A889` teal |

### Why this matters
- `theme/tokens.css` (light) and `theme.css` (dark) **collide on identical variable names** (`--tm-bg`, `--tm-accent`, `--tm-success`, `--tm-danger`, `--tm-*` typography/radii). Whichever `<link>` a page includes last wins. This is a live consistency bug, not just a style preference.
- Some pages load `theme/tokens.css` + `theme/layout.css` + `theme/dashboard.css` (the light system), while others load root `theme.css` (the dark system). Confirmed by inspecting page `<head>` includes (e.g. `dashboard/student/index.html` loads the light tokens; `assessment/index.html` and several instructor/live pages load root `theme.css`).
- The concept's proposed `Surface #F4F7FB` is *very close* to the existing light `theme/tokens.css` background (`#f5f7fb`), and the proposed "light for reading, dark navy for nav" hybrid matches the *existing split* between the light dashboard tokens and the dark public site. **The concept is mostly asking to formalize what is half-built.**

### Recommendation
1. Make `theme/tokens.css` the **single canonical token file** and delete or re-point the divergent root `theme.css` color block so it cannot override the canonical values.
2. Treat the concept's palette (Navy `#14233C`, Blue `#377DE0`, Teal `#26A889`, Surface `#F4F7FB`) as a **proposal to set the canonical values**, validated against WCAG 2.2 AA contrast before adoption. Note the existing system leans on an amber accent (`#f59e0b`) that the concept drops — confirm whether amber is used semantically anywhere (progress/warning) before removing it.
3. Update `design-language/colors.md` to state, explicitly, which file is the single source of truth (it currently only says "use `theme/tokens.css`" but a second colliding file still exists).

### Correction after Phase 1 implementation

Investigation during the Phase 1 token-consolidation PR **narrowed** this finding:

- `public-site/styles.css` does **not** actually collide with the `--tm-*` system —
  it uses its own variable names (`--ink`, `--blue`, `--cyan`). It is a separate,
  self-contained public-site stylesheet, not a third token source.
- The only true collision is **`theme.css` (root, dark) vs `theme/tokens.css` (light)**.
- Root `theme.css` has **5 shipped consumers**: `assessment/index.html` and
  `dashboard/live-session.html` (dark-only; they use `.btn`/`.badge` classes that
  exist only in `theme.css`), plus 3 hybrid instructor pages
  (`instructor/analytics.html`, `instructor/live-session.html`,
  `instructor/research/index.html`) that load `theme.css` **and** `tokens.css`.
- De-linking `theme.css` from those pages is a **layout-affecting change**
  (they rely on `theme.css`-only grid/button classes), so it is deferred until a
  browser UI audit is possible — consistent with the "smallest necessary change"
  and "run UI audits for layout changes" rules.

Phase 1 therefore canonicalized the token *architecture* (see `theme/tokens.css`
and `design-language/colors.md`) without unverifiable page surgery, and preserved
dark semantics as an explicit `[data-theme="dark"]` opt-in rather than forcing all
consumers light. A contract test (`tests/design-token-contract.spec.js`) locks this in.

---

## 3. Route / homepage duplication to resolve

Multiple candidate homepages and legal pages exist at the repo root **and** under `public-site/`:

- Homepages: root `index.html` (branded "TorqueMind"), `main_index.html`, `temp_home.html`, `dashboard_live.html`, `dashboard_test.html`, **and** `public-site/index.html` (branded "AutoLearnPro", has `canonical` + OG tags).
- Legal/contact: root `privacy.html`, `terms.html`, `contact.html` **and** `public-site/{privacy,terms,contact}.html`.
- `public-site/sitemap.xml` currently lists only `/`, `/privacy`, `/terms`, `/contact`, `/accessibility/`.

`public-site/` is clearly the intended production public surface (canonical domain tags, dedicated `styles.css`, `sitemap.xml`, `robots.txt`, `favicon`). The root `index.html`/`temp_home.html`/`dashboard_*.html` appear to be dev/scratch artifacts. **Before any public redesign, confirm the deployment entry point** (see `_redirects`, `wrangler.app.jsonc`, `wrangler.jsonc`) so effort targets the page that actually ships, and archive/ignore the scratch copies.

---

## 4. Gap analysis vs. the proposed six areas

| # | Concept area | Existing | Gap (needs new product functionality) |
| --- | --- | --- | --- |
| 01 | Public website | `public-site/` pages exist | Missing concept pages: About, How It Works, For Students, For Instructors, For Institutions, Help Center. Interactive demo case is a new build. Mostly *content + visual*. |
| 02 | Student learning portal | Strong (dashboard, scenario, labs, coach, transcript, learning-path) | The concept's 5-step reasoning sequence (concern → evidence → evaluate → test → verify) is a **UX model** the current scenario UI should be refactored toward; not fully absent. Assignments + instructor feedback surfaces are thin. |
| 03 | Instructor workspace | `dashboard/instructor/` (analytics, live-session, session-history, research) | Missing: classroom management, case assignment with due dates/attempt limits, structured assessment review, "skills to review" analytics. **Real functional gap.** |
| 04 | Institutional portal | Only backend (institution-search) + `public-site/institutions/` marketing page | **No in-app institutional portal exists.** Programs, cohort management, access control, reporting, org settings are all net-new. |
| 05 | Technical reference library | Backend route + migration + `public-site/research-sources/` | **No three-panel in-app reference UI** (filters / documents / source-permission panel). Permitted-use + revision status at point of use is net-new UI. |
| 06 | Platform administration | `design-language/dashboards/administrator.md` spec only | **No admin dashboard exists** (`dashboard/admin` does not exist). User mgmt, content review queues, audit history, config are all net-new. |

**Takeaway:** Areas 01–02 are largely *redesign*; areas 03 (partly), 04, 05 (UI), and 06 are genuinely *new product functionality* that require backend/worker and data work, not just CSS.

---

## 5. Governance constraints any redesign must respect

Per `AGENTS.md`, `README.md`, and the evidence-governance model, the redesign must **not** weaken:

- **Server-authoritative grading** — the browser never computes correctness (`scenario-submissions-grade.js`, `WORKFLOW.md`). Redesigned assessment UI must keep correct answers out of client payloads.
- **Citation validation / evidence approval** — fail-closed rendering; a visual "Verified" badge must reflect a real validation state, never be decorative.
- **Training vs. assessment separation** — training may give immediate feedback/retry; assessment must not. Any unified component must preserve both modes.
- **Accessibility** — concept targets WCAG 2.2 AA; repo design-language currently states WCAG 2.1 AA. Adopt the higher target and keep status never communicated by color alone.
- **No secrets** — note `dashboard/instructor/index.html` embeds a Supabase anon key inline (this is the public anon key pattern used across the app, but any redesign must keep service-role keys server-side only).

---

## 6. Proposed token decision (for sign-off before Phase 1 code)

If adopting the concept palette as canonical, the mapping would be:

| Concept token | Proposed value | Closest existing token | Notes |
| --- | --- | --- | --- |
| Navy (nav/primary) | `#14233C` | `theme/tokens.css` `--tm-primary` `#0f3d5e` | New value; verify contrast on white text. |
| Blue (interactive) | `#377DE0` | `public-site` `--blue` `#2f8cff` | Replaces/absorbs public-site blue. |
| Teal (secondary interactive / verified) | `#26A889` | (none; cyan `#35d4e5` is decorative) | New semantic; map to "verified/positive" carefully vs. existing green `#15803d`. |
| Surface | `#F4F7FB` | `theme/tokens.css` `--tm-bg` `#f5f7fb` | Effectively unchanged. |
| Amber accent | (dropped) | `#f59e0b` in both token files | **Confirm no semantic dependency before removing.** |

Decision required: adopt concept values as canonical, or keep `theme/tokens.css` values and only adopt the *structure* (hybrid light/dark, teal accent) — pending contrast validation.

---

## 7. Acceptance criteria for the audit itself

- [x] Repository inspected; branch confirmed not `main` (`agent/orchestration-runtime-integration-phase2`).
- [x] Impact analysis captured (three token sets; route duplication; per-area gap table).
- [x] Visual redesign separated from new product functionality.
- [x] No source, test, or generated files modified.
- [x] This document added under `docs/` following existing naming convention; no mermaid blocks (avoids touching the `docs:mermaid` coverage/render contract).

---

## 8. Recommended next steps

1. **Confirm deployment entry point** for the public site, then archive root scratch homepages so there is one canonical public `index.html`.
2. **Token consolidation PR** (Phase 1): unify on `theme/tokens.css`, re-point the colliding root `theme.css`, and decide the palette per Section 6. This is the highest-leverage, lowest-risk change and unlocks every later phase.
3. **Public site content pass** (Phase 2): add the missing marketing/help pages reusing the existing `public-site/styles.css` shell.
4. **Student reasoning-sequence refactor** (Phase 3): model the scenario UI on the 5-step sequence using existing coach/scenario components.
5. **Instructor / institutional / admin** (Phase 4): scope the genuine functional gaps in Section 4; these require worker/API and Supabase work, not just styling — separate them into their own branches per the one-concern-per-commit rule.

---

## 9. Explicitly out of scope of this audit

- No color values, tokens, or stylesheets were changed.
- No tests were run or modified (docs-only change; Jest/Playwright baselines unaffected).
- No routes, worker code, migrations, or generated reports were touched.
- No claims are made about live traffic, performance, or analytics — the concept's success metrics require a real baseline measurement that this audit did not perform.
