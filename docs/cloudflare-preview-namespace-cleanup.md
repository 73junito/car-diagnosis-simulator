# Cloudflare Preview namespace cleanup

Cloudflare API 10067 indicates that the account's 500 Durable Object namespace capacity has been exhausted. Preview namespaces are separate and deleting obsolete Previews releases their storage and namespaces. This repository's prior closed-PR workflow was notice-only.

## Automatic cleanup (after this PR merges)
The `cloudflare-preview-cleanup.yml` workflow runs only when a **same-repository PR closes**. It checks out trusted `main`, derives the preview name from the closing branch using a restricted slug, and calls `wrangler preview delete` on the exact named Preview for **autolearnpro-app** and **autolearnpro-exam**. It uses read-only GitHub permissions and never runs `wrangler delete`. Fork PRs are skipped. Unrecognized branch formats are refused.

**Requirements:** GitHub Actions secrets `CLOUDFLARE_API_TOKEN` (minimal Workers Scripts edit permissions necessary for Preview deletion) and `CLOUDFLARE_ACCOUNT_ID` must already be configured. The account token must be authorized for these two Workers. GitHub workflow credentials cannot grant more privileges than the token itself. Cloudflare deployments handled outside this workflow may use a different naming convention; confirm actual Preview names before relying on cleanup.

**Operational cautions:** Deleting a Preview also deletes its isolated Durable Object storage. Only closed-PR ephemeral data may be targeted. Review branch naming and open PR Preview URLs before activating. If an expected Preview does not exist, Wrangler may report an error; investigate the mismatch rather than widening the scope to arbitrary namespace deletion.

**Important:** This change prevents *future* closed PRs from accumulating previews; it does not automatically clean up hundreds of previews left from already closed PRs. Initial backlog cleanup must inventory Cloudflare Preview names, confirm PR closure and lack of active dependencies, and delete in small reviewed batches. Never remove production Durable Object namespaces or active PR previews.

Cloudflare documentation: https://developers.cloudflare.com/workers/previews/examples/#delete-closed-pull-request-previews
