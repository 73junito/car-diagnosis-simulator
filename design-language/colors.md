# Colors

AutoLearnPro uses a restrained technical palette designed for automotive learning, evidence review, and dashboard readability.

## Canonical source

`theme/tokens.css` is the **single canonical source** for design color tokens.

- The default `:root` block defines the light theme used by current canonical surfaces.
- `:root[data-theme="dark"]` is an explicit opt-in variant. It is not yet approved for production use because the complete dark palette has not been validated to WCAG 2.2 AA.
- The legacy root `theme.css` remains only for unmigrated pages. It is deprecated as a token source; new work must not add or redefine canonical colors there.

The deterministic contrast evidence for the current light-theme palette is recorded in `docs/phase-8a-token-contrast-report.md` and can be reproduced with `node scripts/phase-8a-contrast-check.js`.

## Phase 8A canonical palette

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Navy / primary | `--tm-primary` | `#14233c` | Primary navigation, strong brand surfaces, high-emphasis controls |
| Blue / brand interactive | `--tm-primary-2` | `#377de0` | Brand interactive fills, large/bold text, and qualifying non-text UI |
| Blue / text-safe interactive | `--tm-primary-2-text` | `#2d6ac9` | Normal-size blue text and small white text on blue fills |
| Teal / secondary interactive | `--tm-teal` | `#26a889` | Decorative or large-fill secondary-interactive and verified emphasis |
| Teal / text-safe meaningful UI | `--tm-teal-text` | `#1b8069` | Teal text and meaningful teal UI requiring AA contrast |
| Page surface | `--tm-bg` | `#f4f7fb` | Canonical page background |
| Card surface | `--tm-surface` | `#ffffff` | Cards, panels, forms, content regions |
| Secondary surface | `--tm-surface-2` | `#eef3f8` | Subtle grouped regions and secondary panels |
| Primary text | `--tm-text` | `#102033` | Body text and primary readable content |
| Muted text | `--tm-muted` | `#5f6f82` | Secondary labels and subdued supporting text |
| Border | `--tm-border` | `#d7e0ea` | Decorative dividers; control-boundary usage requires component-level validation |
| Amber accent | `--tm-accent` | `#f59e0b` | Existing warning/in-progress/focus dependencies; retained pending migration |
| Success | `--tm-success` | `#15803d` | Passed, completed, or successful semantic states |
| Warning | `--tm-warning` | `#b45309` | Warning/review-required semantic states |
| Danger | `--tm-danger` | `#b91c1c` | Error, failed, or unsafe semantic states |

## Brand colors versus text-safe colors

The approved brand blue and teal are intentionally preserved even though they are not both valid for every text use.

- `#377de0` measures **4.06:1 on white**. It is suitable for qualifying large/bold text and non-text UI, but not normal-size AA body/link text.
- `#26a889` measures **2.98:1 on white**. It is reserved for decorative or large-fill use where the applicable contrast requirement is satisfied.
- Use `--tm-primary-2-text` for normal-size blue text and small white-on-blue text.
- Use `--tm-teal-text` for teal text and meaningful teal UI.

Do not substitute the lighter brand values into contexts that require the text-safe variants.

## Semantic separation

Brand and semantic roles are intentionally separate.

- Teal means **secondary-interactive or verified emphasis**.
- Teal does **not** mean passed, completed, or successful.
- `--tm-success` alone carries passed/completed success semantics.
- Warning and danger keep their dedicated semantic tokens.
- Every status must include text and/or an icon; color must never be the sole signal.

## Amber retention

`#f59e0b` is retained because it is currently load-bearing across multiple semantic/component dependencies:

- dark-theme warning token;
- focus-visible outlines in the student dashboard;
- progress gradients;
- topbar accent treatment;
- design-token contract expectations.

Do not replace amber with blue or teal during documentation or visual cleanup. This legacy-theme migration introduces and validates dedicated `--tm-focus-ring` and `--tm-focus-ring-inverse` tokens for migrated surfaces. Remaining legacy amber focus usages are retired only when their owning components migrate.

## Known contrast exceptions

The Phase 8A contrast report documents six scoped exceptions. They do not permit sub-AA body text.

Current remediation items include:

- amber focus rings below the 3:1 non-text target;
- decorative border contrast below 3:1 when those borders are used only as non-essential dividers;
- raw brand teal where it would otherwise be treated as meaningful UI.

These exceptions must be resolved at the component-migration layer rather than by silently changing the approved canonical brand values.

## Implementation rules

- Prefer canonical tokens over hard-coded color values.
- Do not create a second token source in page-specific stylesheets.
- Before adding a new color, define its semantic purpose and contrast requirement.
- Interactive, focus, disabled, error, warning, success, and verified states must be validated in their real component context.
- Dark mode remains opt-in and unapproved until its complete state matrix passes WCAG 2.2 AA validation.
