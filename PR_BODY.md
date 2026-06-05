chore: harden regression-issue engine — ZIP artifacts, multi-artifact tests, deterministic persistence

Summary

- Remove the test-only JSON artifact shortcut and make artifact download path 1:1 with GitHub Actions (ZIP).
- Harden production ZIP parsing and add a robust fallback for extracting `slow-tests.json`.
- Add strict integration tests that serve real ZIP buffers and cover multi-artifact aggregation, backoff, decay, flap_count persistence, and owner notifications.
- Fix test alignment for `version-sync` and `api-client` uncovered during this work.

Why

Tests were previously relying on a JSON shortcut and debug branches that made CI behavior diverge from production. This change ensures the regression-issue engine runs identically in tests and CI, making behavior deterministic and reducing flakiness.

What changed (high-level)

- `scripts/auto-open-regression-issues.js`: ZIP-first parsing, manual local-header extraction fallback for robustness, atomic metadata updates (`updateIssueMetadata`), removed JSON shortcut and debug branches.
- `tests/integration/auto-open.expanded.integration.spec.js`: updated to serve real ZIP buffers using `AdmZip`.
- `tests/integration/auto-open.multi-artifact.integration.spec.js`: new test that verifies aggregation across multiple artifacts and correct reopen behavior.
- `dashboard/api-client.js`: avoid background `versionSync.checkNow()` inside the fetch wrapper to align retry behavior with test expectations.
- `dashboard/version-sync.js`: export `checkVersion()` helper and ensure reload banner creation when versions differ (test alignment).

Testing

- Full test suite run locally:
  - `npx jest --config=jest.config.js --runInBand --verbose` — all tests passed locally, including the new integration tests which exercise real ZIP buffers.
- New integration tests specifically exercise:
  - ZIP parsing via `AdmZip` and manual fallback
  - Multi-artifact aggregation and selection (newest first)
  - Flap-count decay and exponential backoff
  - Atomic metadata persistence and owner notification content

Files of interest

- `scripts/auto-open-regression-issues.js`
- `tests/integration/auto-open.expanded.integration.spec.js`
- `tests/integration/auto-open.multi-artifact.integration.spec.js`
- `dashboard/api-client.js`
- `dashboard/version-sync.js`

How to open the PR

1. Create branch and commit:

```bash
git checkout -b chore/harden-regression-engine
git add scripts/auto-open-regression-issues.js dashboard/api-client.js dashboard/version-sync.js tests/integration/auto-open.expanded.integration.spec.js tests/integration/auto-open.multi-artifact.integration.spec.js PR_BODY.md
git commit -m "chore: harden regression-issue engine; ZIP artifacts, tests, atomic metadata"
```

2. Push and open PR (uses `gh`):

```bash
git push -u origin chore/harden-regression-engine
gh pr create --title "chore: harden regression-issue engine — ZIP artifacts, multi-artifact tests, deterministic persistence" --body-file=PR_BODY.md --base main --reviewer 73junito --label ci,regression
```

Notes / follow-ups

- Optional: add a small ZIP-structure validation helper to fail fast on malformed artifacts. This is a minor polish and can be done in a follow-up PR.
- Reviewers: focus on `scripts/auto-open-regression-issues.js` parsing and `updateIssueMetadata` atomic update usage.

### Latest UX Additions

- Added loading skeleton before scenario cards render.
- Improved empty-state messaging when filters return no matches.
- Added Playwright flag `PREVIEW_EMPTY=1` to capture empty-filter screenshots.
- Added updated screenshots for desktop/mobile empty states.

### Screenshots

Overview (desktop): `docs/screenshots/desktop-home-updated.png`  
Overview (mobile): `docs/screenshots/mobile-home-updated.png`  

Detail panel (desktop): `docs/screenshots/desktop-detail-open.png`  
Detail panel (mobile): `docs/screenshots/mobile-detail-open.png`  

Empty state (desktop): `docs/screenshots/desktop-empty-filter.png`  
Empty state (mobile): `docs/screenshots/mobile-empty-filter.png`
