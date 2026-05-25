# Contributing

All changes to this repository must go through a Pull Request (PR) targeting the `main` branch.

Required checks before merging:

- `Unit Tests / unit-tests`
- `Smoke / smoke`

Manual/exception workflows:

- `db-ssl-validation` is a manually triggered workflow and is not a universally required PR check.

Merge requirements:

- At least one approving review is required before merging.
- Branches must be up to date with `main` (require status checks to be up to date).
- Force-pushes to `main` are blocked.
- Deleting the `main` branch is blocked.

Repository administrators are currently subject to the same rules (`enforce_admins: true`).

If you need an exception, contact a repository admin and include the requested exception, the reason it is needed, and the PR or branch it applies to. Do not merge until a repository admin has provided explicit written approval, and link that approval from the PR description or comments.

## CI Requirements: `api-smoke` Workflow & Required Checks

This project uses GitHub branch‑protection rules that require specific CI checks to pass before any pull request can be merged. To avoid merge blocks, contributors must ensure the following checks run and succeed on the **PR branch**:

### Required status checks
- **`unit-tests`** — Jest test suite
- **`smoke`** — UI smoke tests
- **`api-smoke`** — API smoke tests (canonical workflow)

### Important: `api-smoke` must come from GitHub Actions
The `api-smoke` status **must** be produced by the canonical workflow in `.github/workflows/api-smoke.yml`.

Only GitHub Actions can set this status in a way that satisfies branch protection. Manual statuses or statuses from other apps will not unblock merges.

### Re-running the canonical smoke workflow
If a PR is blocked because `api-smoke` is missing or stale:

1. Go to **Actions → API Smoke Test**
2. Select the run associated with your PR branch
3. Click **Re-run all jobs**

This ensures the correct `api-smoke` status is published on the PR head commit.

### Common causes of merge blocks
- The workflow job name was changed (must remain `api-smoke`)
- A temporary or duplicate workflow set a conflicting status
- The workflow was skipped due to path filters
- The PR branch was updated but the workflow didn’t re-run

### Submodules
If your PR updates the `car-diagnosis-sim` submodule:
- Ensure the submodule commit includes any required test or workflow fixes
- CI will run against the submodule’s exact commit, so keep it in sync with your changes

