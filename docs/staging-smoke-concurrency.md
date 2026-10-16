# Staging smoke concurrency and PR verification

`.github/workflows/smoke.yml` serializes staging smoke tests for the same GitHub ref with `cancel-in-progress: false`. GitHub Actions may still supersede an *older pending* request with a newer pending request; that cancellation does **not** establish that smoke tests failed.

Before declaring a PR staging-verified, identify the **most recently created smoke workflow run for that PR** and require a completed `success` conclusion. A newer cancelled/pending/failed run holds verification, even if an older run succeeded.

Run the read-only check with a token authorized to read Actions metadata:

```powershell
$env:GITHUB_TOKEN = '<GitHub token with Actions read access>'
node scripts/check-latest-staging-smoke.js 994
```

This is a **manual verification aid**, not a required branch-protection status check. It does not rerun jobs, modify secrets, or publish assets. The checker inspects the latest 100 PR-triggered smoke runs; if the target PR is missing, it holds instead of assuming success. If a PR has a changed merge ref since its last run, a new smoke run should complete before approving merge. Do not use this script as the sole merge gate without additional commit-SHA freshness validation and branch-protection wiring.

Tests: `npx jest tests/latest-staging-smoke.test.js --runInBand` (Jest suite).
