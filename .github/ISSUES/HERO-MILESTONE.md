# HERO Milestone — Homepage Hero (Sprint 1)

This document is the canonical milestone reference for the Homepage Hero work (HERO-001 → HERO-007).
Use this as the single source of truth for the milestone: issues, PR templates, acceptance criteria and rollup Definition of Done.

## Milestone goal
Deliver a production-ready Hero CTA that supports three behaviors (scroll | demo-load | open-scenario), is accessible, instrumented, and covered by tests.

## Issues (drafts)
- HERO-001 — Define behavior & UX spec — docs/hero-cta.md (spec)
- HERO-002 — Smooth scroll to anchor with sticky-nav offset
- HERO-003 — Demo scenario loader (core integration)
- HERO-004 — Loading state & debounce
- HERO-005 — Track click analytics
- HERO-006 — Keyboard accessibility & ARIA
- HERO-007 — Focus ring styling in `theme.css`

> Note: Issue bodies and full drafts are available in `.github/ISSUES/homepage-hero-issues.md` and the per-issue CSV/JSON artifacts (`.github/ISSUES/homepage-hero-kanban.*`).

## PR templates (per-issue)
Choose the PR template that matches the issue being implemented. Templates live in `.github/PULL_REQUEST_TEMPLATE/`.
- HERO-001: .github/PULL_REQUEST_TEMPLATE/hero-001-ux-spec.md
- HERO-002: .github/PULL_REQUEST_TEMPLATE/hero-002-smooth-scroll.md
- HERO-003: .github/PULL_REQUEST_TEMPLATE/hero-003-scenario-loader.md
- HERO-004: .github/PULL_REQUEST_TEMPLATE/hero-004-loading-debounce.md
- HERO-005: .github/PULL_REQUEST_TEMPLATE/hero-005-analytics.md
- HERO-006: .github/PULL_REQUEST_TEMPLATE/hero-006-keyboard-aria.md
- HERO-007: .github/PULL_REQUEST_TEMPLATE/hero-007-focus-ring.md

## Rollup Definition of Done (milestone-level)
- All HERO-00x issues created in the repo and linked to this milestone.
- Each implemented PR:
  - Uses the matching PR template and completes the Implementation checklist.
  - Attaches `axe` accessibility report (when applicable).
  - Includes unit and/or e2e tests; `npm test` passes on CI.
  - Includes telemetry events documented in `docs/telemetry.md` (when applicable).
  - Has Product/UX and Accessibility owner sign-off comments.
- Visuals validated across mobile/tablet/desktop and high-contrast mode.

## Suggested workflow
1. Run the two-phase `gh` script to create labels and create all 7 issues (Phase 1: labels, Phase 2: issues). See `.github/ISSUES/homepage-hero-kanban.csv` for the ready-to-import board.
2. Assign owners and move issues into the sprint board.
3. Implement HERO-001 first (spec), merge it, then implement dependent issues (HERO-002..HERO-007).

## Artifacts
- Issue drafts: `.github/ISSUES/homepage-hero-issues.md`
- Kanban CSV/JSON: `.github/ISSUES/homepage-hero-kanban.csv`, `.github/ISSUES/homepage-hero-kanban.json`
- PR templates: `.github/PULL_REQUEST_TEMPLATE/hero-*.md`

---

If you want, I can now:
- Run the two-phase `gh` script to create labels and issues (requires `gh` auth), or
- Export this milestone as a printable checklist or a GitHub Project import file grouped by priority.

Tell me which next action you'd like.