# Colors

TorqueMind uses a restrained, professional color system designed for clarity, learning focus, and dashboard readability.

## Primary Roles

- Primary: main brand actions and navigation
- Accent: progress, highlights, and emphasis
- Success: completed tasks and correct outcomes
- Warning: caution, partial progress, or review needed
- Danger: errors, failed checks, or unsafe decisions
- Surface: cards, panels, and dashboard regions
- Border: dividers and component outlines

## Implementation

`theme/tokens.css` is the **single canonical source** for design tokens.

- The default `:root` block defines the **light** theme (content surfaces).
- Dark surfaces are an explicit, **opt-in** variant under `:root[data-theme="dark"]`.
  A page opts in by setting `data-theme="dark"` on `<html>` or an ancestor.
- The legacy root `theme.css` is deprecated as a token source. It still ships a
  second `--tm-*` palette plus some component classes for pages not yet migrated,
  but new work must source every color from `theme/tokens.css`. Do not add new
  tokens to `theme.css`.

Do not hard-code colors inside dashboard files unless a new semantic token is first added to `theme/tokens.css`.
