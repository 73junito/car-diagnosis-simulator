# Cloudflare Preview namespace cleanup

Cloudflare error 10067 means namespace capacity was exhausted. **Do not delete previews based on a guessed git branch-to-preview name.**

## Manual, one-preview-at-a-time cleanup
This PR adds a **manual** workflow, `Cloudflare Preview Cleanup (Manual)`, that is available on the default branch after merge. It never runs automatically upon PR closure.

1. Inventory actual Preview names in Cloudflare, confirm ownership and that the Preview is obsolete, and ensure its isolated Durable Object data is not needed.
2. In GitHub Actions, dispatch this workflow **from main**. Select `autolearnpro-app` or `autolearnpro-exam` and supply the **exact Cloudflare Preview name**, not the branch name unless separately verified.
3. Enter `DELETE-OBSOLETE-PREVIEW`. The job requires the `cloudflare-preview-cleanup` GitHub Environment; configure **authorized reviewers** for this environment before using the workflow. Set narrowly scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets in this environment.
4. Verify deletion and account capacity before repeating. The workflow only targets a single Preview and Worker per run.

**Important:** Preview deletion can erase its isolated Durable Object storage. This workflow does not delete production Workers and makes no change to student grading, simulations, or eligibility. It cannot confirm Preview obsolescence by itself; human review is mandatory. Existing Preview backlog remains until manually reviewed and cleaned up.

Cloudflare CLI reference: https://developers.cloudflare.com/workers/wrangler/commands/workers/
