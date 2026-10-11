# Phase 8A — Legacy Theme Migration Report

**Branch:** `ui/phase-8a-legacy-theme-migration`

**Baseline:** `8bd6560e` (design-language alignment)

**Scope:** the six pages identified by the Phase 8A UX architecture baseline as the legacy-dark migration workstream.

## 1. Migrated pages

1. `assessment/index.html`
2. `dashboard/live-session.html`
3. `dashboard_live.html`
4. `dashboard_test.html`
5. `main_index.html`
6. `temp_home.html`

Each page now loads `theme/tokens.css` and `theme/legacy-light-bridge.css`; dashboard-like surfaces also load the canonical layout/dashboard layers as applicable. None of these six pages loads root `theme.css`.

No application JavaScript, API route, auth rule, analytics behavior, assessment eligibility rule, or instructor/student authorization boundary is changed by this migration.

## 2. Before / after rendered evidence

Evidence was captured in Chromium at 1440×1000 from repository source before and after migration.

| Page | Before body background / text | After body background / text | Result |
| --- | --- | --- | --- |
| `assessment/index.html` | `rgb(11, 17, 23)` / `rgb(249, 250, 251)` | `rgb(244, 247, 251)` / `rgb(16, 32, 51)` | Canonical light |
| `dashboard/live-session.html` | `rgb(11, 17, 23)` / `rgb(249, 250, 251)` | `rgb(244, 247, 251)` / `rgb(16, 32, 51)` | Canonical light |
| `dashboard_live.html` | `rgb(11, 17, 23)` / `rgb(249, 250, 251)` | `rgb(244, 247, 251)` / `rgb(16, 32, 51)` | Canonical light |
| `dashboard_test.html` | `rgb(11, 17, 23)` / `rgb(249, 250, 251)` | `rgb(244, 247, 251)` / `rgb(16, 32, 51)` | Canonical light |
| `main_index.html` | `rgb(11, 17, 23)` / `rgb(249, 250, 251)` | `rgb(244, 247, 251)` / `rgb(16, 32, 51)` | Canonical light |
| `temp_home.html` | `rgb(11, 17, 23)` / `rgb(249, 250, 251)` | `rgb(244, 247, 251)` / `rgb(16, 32, 51)` | Canonical light |

Raw computed-style evidence:

- `docs/evidence/phase-8a-legacy-theme-migration/before.json`
- `docs/evidence/phase-8a-legacy-theme-migration/after.json`

The migration changes the six target surfaces from the legacy dark body palette to the canonical Phase 8A light palette:

- page background: `#f4f7fb`
- primary text: `#102033`
- surface cards: `#ffffff`
- canonical Inter/system font stack

## 3. Compatibility bridge

`theme/legacy-light-bridge.css` is a deliberately narrow compatibility layer for the six migrated legacy surfaces.

It:

- aliases legacy variables used by `style.css` to canonical Phase 8A tokens;
- preserves legacy `.container`, `.btn`, `.badge`, table, card, and status class behavior without reintroducing a second palette;
- maps cards, tables, and statuses to canonical light surfaces and semantic colors;
- keeps root scratch/legacy homepage layout intact while replacing dark visual roles;
- is not a token source and must not be extended for new product work.

New pages/components should use canonical `tm-*` classes directly.

## 4. Focus remediation

This workstream implements the focus remediation deferred by the token PR for these migrated surfaces.

New canonical tokens:

- `--tm-focus-ring: var(--tm-primary-2-text)` → `#2d6ac9` on light surfaces
- `--tm-focus-ring-inverse: #93c5fd` on navy/dark navigation
- `--tm-focus-ring-width: 3px`
- `--tm-focus-ring-offset: 3px`

Measured contrast:

| Focus/status pair | Ratio | Requirement | Result |
| --- | ---: | ---: | --- |
| `#2d6ac9` focus on white | 5.23:1 | 3:1 | PASS |
| `#2d6ac9` focus on `#f4f7fb` | 4.87:1 | 3:1 | PASS |
| `#93c5fd` inverse focus on navy `#14233c` | 8.72:1 | 3:1 | PASS |
| White on navy | 15.73:1 | 4.5:1 | PASS |
| White on warning | 5.02:1 | 4.5:1 | PASS |
| White on danger | 6.47:1 | 4.5:1 | PASS |
| White on success | 5.02:1 | 4.5:1 | PASS |

The historical token contrast report remains unchanged because it records the state of the earlier token-value PR. Its amber-focus E1/E2 findings are now remediated **for these six migrated pages only**; other legacy component usages remain subject to their owning migration workstreams.

## 5. Browser validation

`tests/playwright/phase-8a-legacy-theme-migration.spec.js` validates:

- all six pages load canonical light tokens;
- none of the six loads root `theme.css`;
- body background/text resolve to the canonical Phase 8A light values;
- light-surface controls receive the AA-safe focus ring;
- navy navigation receives the inverse focus ring;
- live-session status retains text plus semantic color rather than color-only meaning.

Current result: **9/9 Chromium tests pass**.

Static contract: `node scripts/phase-8a-legacy-theme-migration-check.js`.

## 6. Standards alignment

The one live stale standard found outside the prior three-file docs commit is corrected:

- `design-language/dashboards/student.md`: WCAG 2.1 AA → **WCAG 2.2 AA**

`design-language/colors.md` and `design-language/accessibility.md` are also updated to reflect that the dedicated focus tokens now exist for migrated surfaces rather than describing them as future work.

## 7. Residual hybrid legacy consumers

A fresh tracked-source scan finds three instructor surfaces that still load root `theme.css` **in addition to** canonical token/layout files:

- `dashboard/instructor/analytics.html`
- `dashboard/instructor/live-session.html`
- `dashboard/instructor/research/index.html`

They were not part of the baseline's six-page migration list, so this branch does not silently expand into them. They belong in the next shared-component/conformance audit, where their remaining monolith dependency can be isolated without touching instructor reporting or authorization behavior.

## 8. Functional freeze

This branch is visual/design-system migration only.

It does **not**:

- expand or enable instructor analytics;
- create instructor→student authorization;
- change analytics API behavior;
- alter assessment display/eligibility/authorization;
- change scenario grading;
- add institutional capabilities;
- modify authentication or roles.

The rendered output changes; product authority and behavior do not.
