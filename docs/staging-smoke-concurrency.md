# Staging smoke concurrency and PR verification

Each staging smoke workflow serializes its own runs for the same GitHub ref with `cancel-in-progress: false`. GitHub Actions may still supersede an *older pending* request with a newer pending request **within that workflow**; that cancellation does **not** establish that smoke tests failed.

## Independent concurrency groups

The two smoke workflows scope their concurrency group to themselves, so they can queue for the same ref without superseding each other:

| Workflow | Concurrency group |
| --- | --- |
| `.github/workflows/smoke.yml` | `staging-smoke-auth-${{ github.ref }}` |
| `.github/workflows/api-smoke.yml` | `staging-smoke-api-${{ github.ref }}` |

Both keep `cancel-in-progress: false`. What the separate groups remove is **cross-workflow** supersession: both files previously declared the same `staging-smoke-${{ github.ref }}` group, so when both queued for one ref GitHub cancelled the older pending run — one workflow silently cancelled the other. That produced a spurious red required check and could hold the verification rule below, because the newest `smoke.yml` run for the PR became `cancelled`.

Regression protection: `npx jest tests/smoke-workflow-concurrency.test.js` reads both workflow files structurally and asserts that the two groups stay distinct for the same ref, that `cancel-in-progress` remains `false`, and that both required check names (`smoke`, `api-smoke`) are still published.

## Residual risk: shared staging fixtures

The two suites now run concurrently against the same staging project. They share the teacher fixture identity (`TEST_TEACHER_EMAIL`, seeded by an idempotent upsert). The class fixture uses a time-derived name (`Smoke Test Class <epoch ms>`) and is deleted by exact id + owner + name, with cleanup failing closed unless exactly one row is deleted. `Date.now()` is not a guaranteed unique run identifier, so two runs starting within the same millisecond could collide; the failure mode is a loud cleanup error rather than silent corruption.

### Session revocation on password reset

`ensureTeacherFixture()` resets the shared teacher password through the Admin API. GoTrue revokes **every** session that user holds whenever a password changes (`User.UpdatePassword` → `Logout` → `DELETE FROM auth.sessions WHERE user_id = ?`). A password reset performed by one workflow therefore invalidates the access token of the sibling workflow that is signed in at that moment. The sibling's next authenticated request then fails with `401 Invalid or expired token`, because GoTrue resolves the JWT's `session_id` claim against the now-empty session row (`session_not_found`).

This was observed as an intermittent `smoke` failure on PR #1128 head `ffc16102`: the concurrent `api-smoke` run's fixture reset at `05:15:51.892Z` landed between the `smoke` run's last successful request (`05:15:51.880Z`, `2/7 OK: create class`) and its next one (`05:15:52.095Z`, `3/7 OK: list classes`), which then returned 401. The same signature appeared on the pre-merge head `9ea17871`, where the sibling's reset at `03:53:46.497Z` fell between `3/7 OK: list classes` (`03:53:46.367Z`) and the failing `4/7 post replay` (`03:53:46.926Z`).

The smoke test therefore signs in **before** it repairs the fixture, so the destructive reset stays off the healthy path and only runs when the stored credential is genuinely rejected (HTTP 400). A transient failure (rate limit, upstream 5xx, network error) never triggers the reset, because it would revoke the sibling's session without repairing anything.

Separate teacher identities per workflow, or a dedicated staging project for one of them, would remove the shared state entirely. That requires additional environment secrets and is not yet provisioned.

Treat concurrent fixture safety as low-risk but **not proven**: on PR #1100 the two workflow runs overlapped, but the two smoke-test *steps* did not overlap in time (23:38:51–23:38:55 and 23:39:07–23:39:10), so simultaneous fixture access has not yet been exercised.

Before declaring a PR staging-verified, identify the **most recently created smoke workflow run for that PR** and require a completed `success` conclusion. A newer cancelled/pending/failed run holds verification, even if an older run succeeded.

Run the read-only check with a token authorized to read Actions metadata:

```powershell
$env:GITHUB_TOKEN = '<GitHub token with Actions read access>'
node scripts/check-latest-staging-smoke.js 994
```

This is a **manual verification aid**, not a required branch-protection status check. It does not rerun jobs, modify secrets, or publish assets. The checker inspects the latest 100 PR-triggered smoke runs; if the target PR is missing, it holds instead of assuming success. If a PR has a changed merge ref since its last run, a new smoke run should complete before approving merge. Do not use this script as the sole merge gate without additional commit-SHA freshness validation and branch-protection wiring.

Tests: `npx jest tests/latest-staging-smoke.test.js tests/smoke-workflow-concurrency.test.js --runInBand` (Jest suite).
