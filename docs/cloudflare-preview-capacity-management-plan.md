# Cloudflare Preview capacity management plan (non-destructive)

Status: proposal only. No preview, namespace, Worker, or GitHub environment change is authorized by this document.

## Baseline (verified from the audit manifest)

Source: `audit-artifacts/cloudflare-preview-eligibility-manifest.json`, generated `2026-10-17T00:38:22.730Z` (GitHub Actions run 38987143141).

| Metric | Count |
|---|---|
| Workers Builds records | 534 |
| Confirmed live (`present_by_name_lookup`) | 440 |
| Absent (404 / error 10025) | 94 |
| Retained (within 30-day review threshold) | 422 |
| Protected / unresolved | 112 (94 `not_live_or_uncertain`, 16 `protected_ambiguous_pr`, 2 `protected_pr_lifecycle`) |
| **Eligible for deletion right now** | **0** |

Historical incident measurement (as of 2026-10-17): 494 of 500 preview-owned Durable Object namespaces appeared in use (6 headroom). Error 10067 is raised when that capacity is exhausted. **This figure is the incident baseline, not a live reading** - current account usage may differ and must be re-measured from a fresh, fully paginated Cloudflare API response before any cleanup decision.

## Why previews consume namespace capacity

`wrangler.app.jsonc` declares a `previews.durable_objects.bindings` entry for `TORQUEMIND_RATE_LIMITER` (class `TorqueMindRateLimitCounter`). Every Worker Preview created for `autolearnpro-app` therefore provisions its own isolated Durable Object namespace. The production rate limiter is unaffected by preview capacity; **never disable the production limiter to relieve preview pressure.**

`autolearnpro-exam` (`wrangler.exam.jsonc`) has no Durable Object bindings (`"previews": {}`), so exam previews do not consume DO namespace capacity. Capacity pressure is an `autolearnpro-app` (and legacy `car-diagnosis-simulator*`) concern.

## Retention calendar (exact `merged_at` + 30 days, not rounded `age_days`)

Computed from the manifest's `merged_at` timestamps as of `2026-10-17T00:51Z`. The 30-day threshold marks **review eligibility only - not automatic deletion.** No Cloudflare auto-deletion schedule at 30 days is asserted anywhere in this plan.

- Reviews already due: **0**
- Reaching threshold within 7 days: **0**; within 14 days: **167**
- First reviews due: **2026-10-25 (20 previews)** and **2026-10-26 (26 previews)** - earliest verified review dates
- Oct 25-31 cohort: **174 previews**
- Last retained preview reaches threshold: 2026-11-16


### Per-date counts (review-eligible date -> previews)

| Date | Count | Date | Count | Date | Count |
|---|---|---|---|---|---|
| 2026-10-25 | 20 | 2026-11-01 | 18 | 2026-11-09 | 24 |
| 2026-10-26 | 26 | 2026-11-02 | 18 | 2026-11-10 | 16 |
| 2026-10-27 | 33 | 2026-11-03 | 9 | 2026-11-11 | 28 |
| 2026-10-28 | 36 | 2026-11-04 | 3 | 2026-11-12 | 23 |
| 2026-10-29 | 24 | 2026-11-05 | 10 | 2026-11-13 | 7 |
| 2026-10-30 | 28 | 2026-11-06 | 1 | 2026-11-14 | 29 |
| 2026-10-31 | 7 | 2026-11-07 | 2 | 2026-11-15 | 25 |
| | | 2026-11-08 | 34 | 2026-11-16 | 1 |

## Unresolved: the 94 absent previews

The 94 absent records return HTTP 404 with Cloudflare error 10025 on preview name lookup. The manifest contains no Durable Object namespace IDs, so **it cannot establish whether these previews left namespaces behind.** Possible explanations (Cloudflare per-Worker preview pruning, manual deletion, name mismatch) are hypotheses, not findings.

Do not assume their namespaces were reclaimed. Until an independent read-only check of the account's Durable Object namespace inventory is performed and reconciled against the expected namespace list, these 94 records are classified as **unresolved namespace status** and excluded from any capacity accounting that claims reclaimed headroom.

Read-only verification path (for a future authorized audit, not part of this change): list Durable Objects namespaces via `GET /accounts/{account_id}/workers/durable-objects/namespaces` with a read-scoped token, following pagination until the response is exhausted, then compare count/names against the 534 Builds records. Capture namespace IDs into future manifests so this gap does not recur.

## Preview creation and naming feasibility

Observed creation paths in this repository:

1. Repository scripts `cloudflare:app:preview` / `cloudflare:exam:preview` run `wrangler preview --config ...` (Wrangler `^4.149.0`).
2. The audit inventory comes from the Workers Builds API (`/builds/workers/{tag}/previews`), and preview names correlate to branch names (`safeName(branch)`), indicating Cloudflare Workers Builds creates most previews from branch builds (`WORKERS_CI_COMMIT_SHA` is referenced in `docs/version-sync.md`).

Feasibility assessment for Cloudflare's recommended deterministic `pr-<number>` naming:

- Naming is fixed at creation time. It can only be applied to **future** previews, and only if the creation mechanism accepts an explicit name (e.g., `wrangler preview --name "pr-<number>"`).
- For Workers Builds branch builds, the preview name is derived from the branch, not from a Wrangler flag. Renaming would require either Cloudflare-side configuration or changing how builds are triggered - **not yet verified as supported in this account.** Do not adopt `pr-<number>` until the creation path is confirmed to honor it.
- Recommended interim lifecycle recording: when a preview is created, record `(PR number, branch, preview name, preview_id, created_at)` in the audit manifest pipeline. The audit script already captures `pr`, `branch`, and `builds_preview_id`; this mapping exists for all 422 verified records.

## Non-destructive capacity actions (ordered, none executed yet)

1. **Re-run the read-only audit before Oct 25** to refresh eligibility and confirm no new previews were created. (Workflow `Cloudflare Live Preview Audit` is dispatch-only and read-only.)
2. **Reconcile the 94 absent records' namespace status** with a read-scoped namespace listing before counting any reclaimed capacity.
3. **Reduce unnecessary preview creation:**
  - Prefer local `npm run` dev servers over `cloudflare:app:preview` for day-to-day work; local dev creates no Preview namespace.
  - Configure Cloudflare Workers Builds to skip builds for branches that cannot produce a reviewable preview (e.g., documentation-only branches), so fewer previews are minted per PR.
  - Avoid re-running preview builds on already-reviewed branches when a build failure can be fixed locally.
4. **Reclaim capacity only through the manual cleanup runbook** (`docs/cloudflare-preview-manual-cleanup-runbook.md`) once previews become review-eligible *and* pass independent approval. Each verified deletion returns namespace headroom for future previews.
5. **If headroom remains critical after 1-4**, open a Cloudflare support request to raise the preview Durable Object namespace limit (500). This is an account setting, not a repository change, and requires human action.

Explicitly out of scope: disabling or weakening the production rate limiter, removing preview DO bindings, deleting previews or namespaces, altering GitHub environments, and deploying Workers.

## Protected records (reviewed, kept protected)

The following manifest records were reviewed and remain protected - they must never be selected for cleanup while their identity remains unverified:

- **16 `protected_ambiguous_pr`** - 15 `history-update-*` branches (plus `-fallback` variants) and `fix-aut250-dashboard-batch002-counts`. Each branch name maps to zero or multiple PRs, so a unique PR identity cannot be established. All are live (`present_by_name_lookup`).
- **2 `protected_pr_lifecycle`** - `chore-state-privacy-ai-overlays` and `feat-student-dashboard-simplify`. The matching PR is not in a uniquely merged, closed state per the audit contract. Both are live.
- **94 `not_live_or_uncertain`** - the absent previews discussed above.
