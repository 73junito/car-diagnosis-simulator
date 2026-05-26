# Release: Codebase Hardening & Lint Cleanup

Commit: 43187e0

## Overview
This release delivers a comprehensive internal cleanup and security hardening pass across the entire project. There are no user-visible feature changes; the update focuses on stability, security, and maintainability.

## Key Improvements
- Full ESLint cleanup: project now passes `npm run lint -- --max-warnings=0` with zero errors.
- DOM-safety hardening: removed unsafe DOM sinks (`innerHTML`, `insertAdjacentHTML`, template HTML) and replaced with safe DOM construction patterns.
- Test suite modernization: updated fixtures to avoid HTML injection and unused imports; all tests pass (12/12 suites, 75 tests).
- Structural cleanup: removed unused variables, resolved undefined globals, replaced empty blocks with explicit no-ops, moved inner declarations to expressions, eliminated unreachable code.
- Browser globals standardized via `globalThis` where appropriate.

## Security
- Eliminated direct HTML injection points (DOM-XSS vectors).
- Standardized safe DOM APIs across the codebase.

## Notes for Maintainers
- See `docs/MIGRATION_NOTE.md` for contributor guidelines and enforced conventions (DOM-safety, lint expectations, test fixture rules).
- No migration steps required for consumers. This change is behavior-preserving.

## Suggested Tag
`v0.1.x`

---

If you'd like, I can push the branch and open a PR with this release note and the migration note included.