# Instructor Theme-Conformance Audit

## Scope

Inventory-only audit of the three instructor surfaces that remained hybrid consumers after Phase 8A:

- `dashboard/instructor/analytics.html`
- `dashboard/instructor/live-session.html`
- `dashboard/instructor/research/index.html`

Baseline: `main` at `2d789dda9ff1078618edd1fe9c36cad29e734d95` (merge of PR #849).

This audit does not modify HTML, CSS, JavaScript, APIs, authorization, analytics calculations, data contracts, assessment eligibility, grading, or interaction semantics.

## Shared finding

All three pages load the hybrid stack:

1. `/theme.css`
2. `/theme/tokens.css`
3. `/theme/layout.css`
4. `/theme/dashboard.css`

The canonical stack is already present. The remaining question is whether root `theme.css` supplies active compatibility behavior, duplicates canonical rules, or is obsolete.

Root `theme.css` also sets global `body` padding. `theme/tokens.css` resets margin/background/color/font but does not reset that padding, so loading root `theme.css` still changes page geometry even when canonical `tm-*` components win later in the cascade.

## 1. Instructor Analytics

### Current dependencies

The page mixes canonical classes with legacy aliases on the same elements:

- `container tm-main`
- `cards tm-dashboard-grid tm-dashboard-grid-4`
- `card tm-card tm-stat-card`
- `label tm-stat-card__label`
- `value tm-stat-card__value`
- `btn btn-ghost`

Root `theme.css` actively defines the legacy selectors:

- `.container`
- `.cards`
- `.card`
- `.card .label`
- `.card .value`
- `.btn`
- `.btn-ghost`
- `.students`
- `.exports`

The same page also has canonical coverage through `tm-main`, dashboard-grid rules, `tm-card`, `tm-stat-card`, `tm-table`, and `tm-btn`.

### Classification

**Active legacy compatibility dependency plus duplicated canonical styling.**

The most important conflict is selector specificity: `.card .label` and `.card .value` from root `theme.css` can outrank the single-class canonical stat-card selectors even though the canonical styles load later. That means the hybrid state is not merely redundant; it can alter Phase 8A typography and color decisions.

### Existing bridge coverage

`theme/legacy-light-bridge.css` already contains canonical-token-backed replacements for the relevant legacy analytics aliases, including cards, labels, values, buttons, badges, tables, exports, and students.

### Recommended migration path

1. Do not change `dashboard/instructor/analytics.js`, analytics calculations, endpoints, auth, or data contracts.
2. Prefer removing legacy presentation class names from the analytics markup where a canonical `tm-*` class already exists.
3. Where a legacy class is still required by current markup or generated content, use `theme/legacy-light-bridge.css` instead of root `theme.css`.
4. Validate computed styles, table rendering, export controls, responsive grid behavior, and focus states.
5. If any visual migration requires functional JavaScript changes, defer that part under the existing analytics functional freeze.

## 2. Instructor Live Session

### Current dependencies

The initial markup is mostly canonical:

- `container tm-main`
- `tm-hero-banner*`
- `tm-pill`
- `tm-btn tm-btn-secondary`
- `tm-panel`

However, `dashboard/instructor/live-session.js` replaces the connection-status class at runtime with legacy classes:

- `badge badge-warn`
- `badge badge-success`
- `badge badge-danger`

Root `theme.css` supplies those badge styles. The Phase 8A legacy bridge also supplies canonical-token-backed equivalents, including explicit `#conn-status.badge-*` rules.

### Broken stylesheet reference

The page links:

`./live-session.css`

From `dashboard/instructor/live-session.html`, that resolves to:

`dashboard/instructor/live-session.css`

No file exists there.

The only matching stylesheet is:

`dashboard/live-session.css`

That stylesheet contains the intended `.live-list`, `#live-summary`, and connection-status rules.

### Classification

**Active runtime legacy-class dependency plus an obsolete/broken relative stylesheet reference.**

The root-theme dependency can be replaced by the existing compatibility bridge without changing the live-session JavaScript. The broken stylesheet reference is a separate visual delivery defect and should be corrected in the implementation phase.

### Recommended migration path

1. Keep `live-session.js` behavior unchanged.
2. Replace root `theme.css` with `theme/legacy-light-bridge.css` so existing JS-generated badge classes retain visual semantics.
3. Correct the stylesheet path to the existing `dashboard/live-session.css` using the appropriate relative or absolute URL.
4. Verify disconnected/connecting/connected/error states, event-list rendering, focus styling, and responsive behavior.
5. Do not alter event-stream logic or connection semantics.

## 3. Instructor Research

### Current dependencies

The page is overwhelmingly canonical:

- `tm-main`
- `tm-hero-banner*`
- `tm-panel`
- `tm-btn tm-btn-primary`
- `tm-btn tm-btn-secondary`

The extra `container` class is paired with `tm-main`; the later canonical `tm-main` rule supplies its own max width, margins, and padding.

No research-specific legacy component rules were found in root `theme.css`.

### Separate conformance gaps

The research forms use bare `select`, `textarea`, and search `input` elements rather than canonical `tm-select`, `tm-textarea`, and `tm-input` classes. Root `theme.css` does not provide generic element styling for those controls, so this is not a reason to retain root `theme.css`.

The page also contains:

- one inline layout style on the existing-gap controls
- a `fine-print` class with no matching rule in the canonical theme stack or root `theme.css`

Those are independent presentation-conformance findings.

### Classification

**Obsolete compatibility load / accidental inheritance.**

Root `theme.css` is not providing a meaningful research-specific component dependency. Its main remaining effect is global legacy geometry such as body padding.

### Recommended migration path

1. Remove root `theme.css`.
2. Canonicalize form-control classes and the one inline layout rule in a visual-only change.
3. Define or replace the orphan `fine-print` presentation with an existing canonical text utility/component.
4. Do not modify research workflow JavaScript, evidence-gap behavior, API calls, AI-assisted draft behavior, governance boundaries, or saved-evidence semantics.

## Dependency classification summary

| Surface | Root theme reason | Classification | Safe direction |
| --- | --- | --- | --- |
| Instructor Analytics | Legacy aliases overlap canonical components and still affect cascade/specificity | Active dependency + duplicated styling | Canonicalize markup; bridge only where needed |
| Instructor Live Session | Runtime JS emits legacy badge classes; local stylesheet link is broken | Active compatibility dependency + broken stylesheet reference | Bridge badge aliases; fix CSS URL; keep JS behavior |
| Instructor Research | No meaningful component dependency; mostly canonical already | Obsolete/accidental inheritance | Remove root theme; clean visual-only form/text gaps |

## Functional freeze

For `dashboard/instructor/analytics.html`, follow-on work remains visual/theme conformance only.

Do not change:

- analytics calculations
- API behavior
- data contracts
- authorization or role checks
- instructor-to-student scoping
- event or interaction semantics
- assessment eligibility or grading behavior

If removal of a legacy style requires a functional change, defer rather than cross the freeze boundary.

## Proposed implementation order

1. **Research** — lowest-risk root-theme removal because no meaningful root component dependency was found.
2. **Live Session** — replace root theme with bridge and repair the broken stylesheet path while preserving JS behavior.
3. **Analytics** — migrate last because legacy aliases and canonical classes overlap and selector specificity currently affects rendered presentation.

Each surface should receive computed-style and browser regression evidence before merge.
