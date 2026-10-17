# Cloudflare Preview manual cleanup runbook

Status: runbook only. **No deletion is authorized by reading this document.** Every deletion requires a separately executed, independently approved run of the `Cloudflare Preview Cleanup (Manual)` GitHub workflow.

Companion document: `docs/cloudflare-preview-capacity-management-plan.md`.

## Preconditions

Before any cleanup session:

1. Re-run `Cloudflare Live Preview Audit` (read-only, dispatch-only) to obtain a fresh manifest. Never plan deletions from a stale manifest.
2. Confirm the account's **current** preview DO namespace usage from a fresh, fully paginated read-only API response (`GET /accounts/{account_id}/workers/durable-objects/namespaces`, following pagination until exhausted). The 494/500 figure is the historical incident measurement from 2026-10-17, not a live reading. Cleanup is only worthwhile when headroom is actually needed.
3. Confirm the `cloudflare-preview-cleanup` GitHub Environment exists with **authorized reviewers configured** and narrowly scoped `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets set at environment scope. If reviewers are not configured, stop.

## Per-preview checklist (all five required)

A preview may be submitted for deletion only when every item below is satisfied and recorded in the approval note:

1. **Exact Worker + Preview identity.** The cleanup workflow accepts exactly two Worker inputs - `autolearnpro-app` and `autolearnpro-exam` (a `workflow_dispatch` choice list, re-validated server-side before deletion). Any legacy `car-diagnosis-simulator*` cleanup would require a **separately reviewed workflow change** first and is out of scope for this runbook. Preview name is taken verbatim from the fresh manifest's live name lookup - never guessed from a branch name, never copied from an old manifest. Record `preview_id` from the manifest and confirm it matches the live lookup response.
2. **Retention eligibility.** The preview's `eligibility` in the fresh manifest is `review_required` (its exact `merged_at` + 30 days is at or before the run date). `retained`, `protected`, `not_live_or_uncertain`, `protected_ambiguous_pr`, and `protected_pr_lifecycle` records are ineligible. The 30-day threshold marks review eligibility only - reaching it never auto-authorizes deletion.
3. **PR lifecycle verified.** The correlated PR is uniquely matched, `closed`, merged, and its head branch belongs to `73junito/car-diagnosis-simulator` (manifest `review = reviewable_merged_live`, `identity = verified`).
4. **Durable Object data declared expendable.** The approver explicitly states that the preview's isolated `TORQUEMIND_RATE_LIMITER` storage is not needed (no debugging, forensics, or in-flight review depends on it).
5. **Independent approval.** A person other than the requester approves the run via the `cloudflare-preview-cleanup` environment reviewer gate. The requester may not self-approve. Record approver, timestamp, PR number, preview name, and `preview_id`.

## Execution

1. From `main`, dispatch `Cloudflare Preview Cleanup (Manual)`.
2. Inputs: exact Worker name, exact Preview name, confirmation string `DELETE-OBSOLETE-PREVIEW`.
3. The workflow deletes **one** preview per run (`wrangler preview delete --worker-name ... --name ... --skip-confirmation`). Do not batch, script, or loop deletions.
4. If the workflow fails, preserve its output and classify the failure before any retry. Never widen the input to work around a failure.

## Post-deletion namespace verification (required)

After each single deletion:

1. Record the workflow run URL and step summary output.
2. Re-check account preview DO namespace usage via a **fresh, fully paginated read-only** namespace listing and verify the **expected namespace recovery** for this deletion. Do not assume every Preview deletion produces an immediate, exactly-one namespace reduction: Cloudflare may reclaim storage asynchronously, and unrelated builds may consume headroom concurrently. If the expected recovery cannot be reconciled from the response, stop the cleanup session and investigate - do not continue deleting.
3. Confirm the production Worker still serves and that the production rate limiter is unaffected (production namespace is `TORQUEMIND_RATE_LIMITER` on `autolearnpro-app`, distinct from preview namespaces).
4. Re-run the live audit (or at minimum the name lookup for the deleted preview) to confirm the preview is now absent and no other record changed unexpectedly.

If capacity does not recover as expected after a confirmed deletion, escalate to the capacity-management plan's unresolved-namespace investigation instead of deleting more previews.

## Prohibited

- Deleting any of the 112 protected/unresolved records.
- Deleting based on branch name, rounded `age_days`, or an expired manifest.
- Automated or scheduled deletion (the scheduled reconciliation workflow remains dry-run; `PREVIEW_CLEANUP_APPLY` throws by design).
- Deleting production or staging Workers, altering GitHub environments, or changing Wrangler configs as part of cleanup.
- Counting the 94 absent previews' namespaces as reclaimed capacity before independent verification.

Cloudflare CLI reference: https://developers.cloudflare.com/workers/wrangler/commands/workers/
