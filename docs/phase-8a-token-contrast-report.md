# Phase 8A — Canonical Token Contrast Report (WCAG 2.2 AA)

**Status:** final for the Phase 8A token-value PR.
**Baseline:** `40ce4eaa` (Phase 8A UX architecture baseline).
**Target:** WCAG 2.2 AA — text 4.5:1, large/bold text & non-text UI 3:1 (SC 1.4.3, 1.4.11).
**Validator:** `node scripts/phase-8a-contrast-check.js` (deterministic, re-runnable; exit 0 = all required checks pass).
**Scope:** `theme/tokens.css` light `:root` tokens only. No component, layout, or behavioral change in this PR.

## 1. Approved palette as implemented (decision D2)

| Role | Token | Value |
| --- | --- | --- |
| Navy — nav / primary | `--tm-primary` | `#14233c` |
| Blue — interactive (brand fill) | `--tm-primary-2` | `#377de0` |
| Blue — interactive, AA text | `--tm-primary-2-text` | `#2d6ac9` *(derived)* |
| Teal — secondary interactive / verified (brand fill) | `--tm-teal` | `#26a889` |
| Teal — AA text / meaningful UI | `--tm-teal-text` | `#1b8069` *(derived)* |
| Surface | `--tm-bg` | `#f4f7fb` |
| Semantic success | `--tm-success` | `#15803d` *(unchanged)* |
| Semantic warning | `--tm-warning` | `#b45309` *(unchanged)* |
| Semantic danger | `--tm-danger` | `#b91c1c` *(unchanged)* |
| Amber accent (retained) | `--tm-accent` | `#f59e0b` *(unchanged)* |

**Why derived tokens exist:** the mandated brand blue measures **4.06:1** on white and brand teal measures **2.98:1** — both fail AA for normal-size text (4.5:1), and teal even misses the 3:1 non-text floor. Rather than alter approved brand values or waive the requirement, each brand hue keeps its approved hex for fills/large text/decorative use and gains a hue-faithful darkened variant for text and meaningful UI. This is recorded as an implementation refinement of D2, not a palette change.

## 2. Result summary

- **32 of 32 required checks PASS** (0 failures).
- **6 KNOWN-EXCEPTIONS** documented in §5.
- Reproduce with `node scripts/phase-8a-contrast-check.js`.

## 3. Text checks (≥ 4.5:1) — all pass

| Pair | Ratio | Min |
| --- | --- | --- |
| `--tm-text` on `--tm-bg` | 15.31 | 4.5 |
| `--tm-text` on `--tm-surface` | 16.45 | 4.5 |
| `--tm-text` on `--tm-surface-2` | 14.74 | 4.5 |
| `--tm-muted` on `--tm-surface` | 5.14 | 4.5 |
| `--tm-muted` on `--tm-surface-2` | 4.61 | 4.5 |
| white on `--tm-primary` (nav/buttons) | 15.73 | 4.5 |
| `--tm-primary` on `--tm-surface` / `--tm-bg` | 15.73 / 14.64 | 4.5 |
| white on `--tm-primary-2-text` (interactive fill, small text) | 5.23 | 4.5 |
| `--tm-primary-2-text` on `--tm-surface` / `--tm-bg` | 5.23 / 4.87 | 4.5 |
| white on `--tm-teal-text` (verified chip) | 4.84 | 4.5 |
| `--tm-teal-text` on `--tm-surface` / `--tm-bg` | 4.84 / 4.51 | 4.5 |
| white on `--tm-success` / success on surface / bg | 5.02 / 5.02 / 4.67 | 4.5 |
| white on `--tm-warning` / warning on surface / bg | 5.02 / 5.02 / 4.67 | 4.5 |
| white on `--tm-danger` / danger on surface / bg | 6.47 / 6.47 / 6.02 | 4.5 |


## 4. Interactive controls, focus, disabled, status (≥ 3:1 non-text)

| Pair | Ratio | Min |
| --- | --- | --- |
| Brand blue `--tm-primary-2` on surface / bg (large text, non-text UI) | 4.06 / 3.78 | 3 |
| White on brand blue (large/bold button text only) | 4.06 | 3 |
| `--tm-teal-text` on surface / bg (meaningful teal UI) | 4.84 / 4.51 | 3 |
| Teal vs success distinguishable (adjacency) | 1.68 | 1.2 |
| Warning vs danger distinguishable (adjacency) | 1.29 | 1.2 |

**Disabled state:** foreground `--tm-muted` on `--tm-surface` / `--tm-surface-2` = 5.14 / 4.61 — passes 4.5:1, so disabled labels remain readable.

**Status rules (D3):** status must never be color-only — pair every status color with text/icon; teal (`--tm-teal*`) means *secondary-interactive / verified emphasis*, never *passed*; `--tm-success` alone carries the passed/completed meaning.

## 5. Known exceptions (explicitly documented, remediation scheduled)

| # | Pair | Measured | Wanted | Why retained / remediation |
| --- | --- | --- | --- | --- |
| E1 | amber `--tm-accent` focus ring on surface | 2.15 | 3 | Amber retention deferred per audit gate: amber is still semantically load-bearing (`dashboard/student/student.css` focus-visible outlines, topbar accent, progress gradients, dark `--tm-warning`). Focus-ring replacement ships with the component-migration workstream, not the token PR. |
| E2 | amber focus ring on `--tm-bg` | 2.00 | 3 | Same as E1. |
| E3 | `--tm-border` on surface | 1.33 | 3 | Decorative card dividers. Borders that *identify a control* (inputs, standalone buttons) must meet 3:1 — fixed in the component-migration workstream. |
| E4 | `--tm-border` on `--tm-bg` | 1.24 | 3 | Same as E3. |
| E5 | brand teal `--tm-teal` on surface (as meaningful UI) | 2.98 | 3 | Brand value mandated by D2. Rule enforced via token comment: decorative/large-fill only; meaningful teal UI uses `--tm-teal-text` (passes, §4). |
| E6 | brand teal `--tm-teal` on `--tm-bg` (as meaningful UI) | 2.77 | 3 | Same as E5. |

No exception permits a text pair below 4.5:1 — all text combinations pass AA.

## 6. Amber (`#f59e0b`) dependency audit — decision: RETAIN

Usages found by repo-wide search (retirement was gated on this audit):

1. `theme/tokens.css` `--tm-accent` (light) and `--tm-warning` (dark variant) — **semantic warning**.
2. `dashboard/student/student.css` — `#btnResume:focus-visible` outline (focus indicator), coach-panel accent border.
3. `theme/layout.css` — topbar accent border.
4. `theme/components/progress-card`, `learning-path` — progress gradients (connoting *in-progress*, amber semantics).
5. `tests/design-token-contract.spec.js` — requires `--tm-accent` to exist.

**Conclusion:** amber carries warning/in-progress semantics in at least three independent places; replacing it with blue/teal would either destroy semantic meaning or require a new token. Retirement is **not** executed in this PR; revisit in the component-migration workstream by introducing a dedicated `--tm-focus-ring` first (remediation for E1/E2).

## 7. Dark variant note

The opt-in `[data-theme="dark"]` block is synced to the brand palette (primary/primary-2/teal) but remains **unvalidated for WCAG 2.2 AA** as a whole; no page opts in (locked by `tests/design-token-contract.spec.js`). Dark contrast validation is a prerequisite of any future dark-mode work and is intentionally out of scope here.

## 8. What this PR does NOT change

- No legacy `theme.css` page migration (third workstream).
- No layout/component redesign; no HTML, JS, or behavioral change anywhere.
- Semantic success/warning/danger values unchanged.
- Functional boundaries (instructor analytics, assessment eligibility, authorization) untouched — docs/token-only diff confirmed via `git diff --stat`.
