# CI Contract

This document defines the project's CI "contract": which checks gate merges, which checks provide informational signals, and how to diagnose and re-run the canonical workflows.

## Purpose

Provide a single source of truth for CI behavior so contributors and automation can rely on consistent, named checks and predictable merge gating.

## Required status checks (merge gate)

The following checks are required by branch protection on `main` and must be `success` on the PR head commit before merging:

- `unit-tests` — fast, deterministic Jest unit tests
- `smoke` — lightweight integration / smoke tests validating basic UI flows
- `api-smoke` — canonical API smoke workflow (must be produced by GitHub Actions)

These checks are the only blockers for merging to `main`.

## Non-blocking quality signals

The following runs are valuable but intentionally non-blocking:

- CodeQL / security scans
- Linting or dependency checks
- Extended cross-browser or environment validation

They should run on PRs but not prevent merging.

## Why `api-smoke` must come from GitHub Actions

Only GitHub Actions runs reliably publish a status that satisfies branch protection. Statuses set manually or by third-party apps may not unblock merges. Keep the workflow file name and job name stable (`.github/workflows/api-smoke.yml` and job/context `api-smoke`).

## How to re-run the canonical smoke workflow

1. Go to the repository Actions tab → select the `API Smoke Test` workflow.
2. Find the run associated with the PR branch / head commit.
3. Click **Re-run all jobs**.

This re-publishes the `api-smoke` status on the same commit so branch protection can evaluate it.

## Branch-protection & contexts

- Branch protection evaluates the set of required contexts on the PR head commit. If a context is missing or shows `neutral`/`failure`, merging will be blocked.
- Keep required contexts minimal and stable to avoid flaky merge gating.

## Submodule behavior

- CI runs against the exact commits referenced by submodules. If a PR updates a submodule reference, ensure that submodule commit has any needed fixes and that CI runs for that commit.

## Common failure modes & diagnosis

- `mergeable: UNKNOWN` or `statusCheckRollup: null`: GitHub is still computing the rollup — consult individual check-runs for truth.
- Missing context: workflow renamed or skipped by path filters.
- Conflicting statuses: duplicate workflows or external apps set inconsistent statuses; re-run canonical workflow and prefer GitHub Actions runs.

## Workflow naming and mergeability

Keep job names stable. Changing a job name (context) will create a new required context and may cause temporary merge blocks until branch protection is updated.

## Safely updating workflows

1. Add the new workflow or job name in a single PR against `main` and allow it to land before updating branch protection.
2. If renaming an existing required job, coordinate by adding the new job as non-required, land it, update branch protection, then remove the old job.

## Contact / ownership

List workflow owners or teams responsible for the `api-smoke`, `smoke`, and `unit-tests` workflows here so contributors know who to contact for exceptions or fixes.

---

This file is the canonical reference for CI behavior. Link to it from `CONTRIBUTING.md`.
