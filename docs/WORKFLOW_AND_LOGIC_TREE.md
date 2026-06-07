**Project Workflow & Logic Tree**

Purpose
-------

This document captures the recommended development, testing, CI, and incident decision logic for the Car Diagnosis Simulator repository. It's intended to be authoritative for engineering and CI configuration decisions, test triage, and release gates.

**Branching & Releases**
- **main**: protected. All changes must come through PRs that pass required checks.
- **develop / feature/***: feature branches for work; open PRs against `main`.
- **release/***: created when cutting a release. CI run: full integration, smoke, e2e.
- **hotfix/***: created off `main` for urgent fixes; require expedited review and green CI.

**PR Requirements**
- Required checks: `Run ESLint`, `Unit Tests / unit-tests` (Jest), `Build`, `Playwright Smoke`.
- For E2E changes touching UI/UX or tests: add Playwright E2E job (full) as required before merge.
- One approving review required. Branch must be up to date.

**CI Pipelines (recommended jobs)**
- `lint`: runs ESLint, fails fast on style/security issues.
- `unit-tests` (Jest): runs `npm test` — must use the Jest config to exclude Playwright tests.
- `build`: produce production artifacts and verify static-site build.
- `playwright-smoke`: deterministic smoke test for student dashboard (fast, single-browser). Runs on PR and scheduled.
- `playwright-e2e`: full Playwright suite runs in a separate job, with artifacts (traces/videos/screenshots) uploaded on failure. This job should be optional for low-risk UI-only PRs but required for changes that touch UI or telemetry flows.
- `publish` / `deploy`: gated on successful build and required checks.

Implementation notes
- Keep Jest and Playwright discovery isolated: Playwright `testDir: 'tests/playwright'` and `testMatch` present; Jest config must not include Playwright paths.
- Reporter/artifact layout: set Playwright HTML reporter to `test-results/playwright-html` and test-results to `test-results/playwright` to avoid folder overlap.

**Local developer workflow**
- Install deps: `npm ci`.
- Start a local static server for UI: `npm run start` (or `npx http-server public -p 3003`).
- Run unit tests: `npm test` (fast, uses jsdom). Use `--watch` for local TDD.
- Run Playwright smoke locally: `npm run test:playwright -- --grep "smoke"`.
- Run full Playwright: `npm run test:playwright`.

**Testing & Isolation**
- Tests must be deterministic and isolated: avoid sharing global state across tests; use per-test fixtures.
- Use `window.SCENARIO_REGISTRY` read-only in tests to verify card counts rather than coupling to DOM-only counts where possible.
- Playwright tests should capture `page.on('pageerror')` and `page.on('console')` errors and fail the test if unexpected errors are emitted.

**Flaky Test & Triage Process**
- When a test is flaky or fails in CI:
  - Step 1: Re-run the failing job in CI once to confirm.
  - Step 2: If still failing, collect artifacts (trace/video/screenshots, console logs, page errors). Attach to the PR.
  - Step 3: Assign an owner (author or on-call) to investigate within 24 hours.
  - Step 4: If root cause is UI timing, add deterministic waits or replace brittle selectors. If root cause is environment, add guard or skip with triage label.
  - Step 5: If immediate merge is blocked, create a temporary fix branch or revert the offending change. Use minimal scope changes.

Labels and metadata
- `flake`: flaky test observed — triage required.
- `e2e-fail`: Playwright failure — include artifacts.
- `ci-fail`: general CI failure.

**Decision Logic Tree (high-level)**

```mermaid
flowchart TD
  A[PR opened] --> B{Files touched include UI or tests?}
  B -- No --> C[Run lint + unit tests]
  C --> D{All green?}
  D -- Yes --> E[Merge allowed]
  D -- No --> F[Fail PR - fix issues]
  B -- Yes --> G[Run lint + unit tests + playwright-smoke]
  G --> H{Smoke green?}
  H -- No --> I[Collect smoke artifacts & fail PR]
  H -- Yes --> J[Run playwright-e2e job]
  J --> K{E2E green?}
  K -- Yes --> E
  K -- No --> L[Collect artifacts & start flaky triage]
  L --> M{Deterministic fix available quickly?}
  M -- Yes --> N[Apply fix, re-run
  M -- No --> O[Label flake, assign owner, optionally unblock with revert/patch]
```

**Runbook: CI Failure (playwright-e2e)**
1. Open the failing workflow run and download traces, videos, and screenshots.
2. Re-run the job once. If green, mark as transient and leave a comment.
3. If still failing, reproduce locally with `npx playwright test tests/playwright --project=chromium --trace=on --reporter=list`.
4. If reproduction succeeds, create a minimal repro branch and PR identifying the root cause.
5. If reproduction fails locally, escalate: capture full CI environment dump (node version, env vars), and add the `ci-fail` label.

**Emergency rollback**
- If a production deploy causes a regression: revert the PR/merge commit, create a hotfix branch from `main`, deploy the hotfix after tests pass.

**Monitoring & Alerts**
- Add scheduled Playwright smoke runs (nightly) to detect regressions.
- Configure CI notifications to Slack/email for failing required checks on `main`.

**Onboarding & Documentation**
- Link this doc from `README.md` and the repository Contributing docs.
- Add a short checklist for new contributors: run `npm test`, run `npm run test:playwright` locally, and ensure no Playwright artifacts overlap.

**Next steps (recommended low-effort ops to apply now)**
1. Change Playwright reporter folder to `test-results/playwright-html` to remove the conflict reported locally.
2. Add a GitHub Actions job step to upload Playwright artifacts (trace/video) on failure.
3. Add a scheduled nightly smoke-run workflow.

End of document.
