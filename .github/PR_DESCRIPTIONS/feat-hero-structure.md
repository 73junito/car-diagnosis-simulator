# PR: Add Hero Structure, Diagnostic Card, and Homepage Wireframe

## Summary

This PR introduces the full TorqueMind homepage foundation, including:

- New **Hero section** with theme‑aligned layout + CTAs
- Reusable **Diagnostic Preview Card** component
- Polished **Scenario Card** grid with hover elevation + responsive layout
- Full **Homepage Wireframe** (scenarios, instructor CTA, features, footer)
- Instructor CTA polish + preview panel
- All supporting CSS added to `theme.css` using existing theme tokens

This establishes the visual and structural baseline for the TorqueMind landing experience.

---

## Changes Included

### Hero
- Added `tm-hero` structure (HTML skeleton)
- Added hero CSS using theme tokens
- Inlined diagnostic preview card into hero

### Diagnostic Card
- Created reusable component (`components/diagnostic-card.html`)
- Added utility classes (`metric-large`, `badge-soft`)
- Inlined into homepage hero

### Scenario Cards
- Implemented scenario card components
- Added hover elevation, spacing, typography polish
- Added responsive grid rules

### Instructor CTA
- Added CTA section markup
- Added CTA polish CSS (panel, preview card, responsive collapse)

### Homepage Wireframe
- Added scenario grid section
- Added instructor CTA section
- Added feature rows
- Added footer structure
- Added all supporting CSS

---

## Reviewer Checklist
Please verify the following in a local browser:

### Hero
- [ ] Hero layout renders correctly (two‑column on desktop, stacked on mobile)
- [ ] Diagnostic preview card displays with correct spacing + theme colors
- [ ] CTAs use correct button variants

### Scenario Grid
- [ ] Cards elevate on hover
- [ ] Grid displays 3‑column → 2‑column → 1‑column responsively
- [ ] Typography + spacing match theme

### Instructor CTA
- [ ] CTA section has correct panel background + spacing
- [ ] Preview card displays with subtle shadow
- [ ] Layout collapses cleanly on mobile

### Features + Footer
- [ ] Feature rows align correctly
- [ ] Footer links render with correct spacing + muted text

### General
- [ ] No console errors
- [ ] No layout shifts or broken spacing
- [ ] All new CSS uses theme tokens (`--space-*`, `--panel`, `--border-soft`, etc.)

---

## Next Steps (Post‑Merge)
- Add mini analytics widget to CTA preview
- Add icons/illustrations to scenario cards
- Begin scenario library page
