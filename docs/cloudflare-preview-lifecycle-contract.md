# AutoLearnPro Preview Lifecycle Contract

This phase adds an offline, read-only policy guard for the existing Cloudflare previews and their Durable Object bindings.

## Current contract

- The production `autolearnpro-app` rate-limiter uses `TORQUEMIND_RATE_LIMITER` and the existing `TorqueMindRateLimitCounter` class.
- `wrangler.app.jsonc` explicitly declares an equivalent `previews.durable_objects.bindings` entry for preview isolation. Existing `exports` class lifecycle and SQLite storage remain unchanged.
- Preview and staging Semantic Scholar flags remain disabled; production remains enabled.
- Scheduled reconciliation remains report-only, without deletion privileges. The existing manual cleanup workflow stays separate, on its protected environment and explicit confirmation.
- A successful validation does not establish preview deletion eligibility, live ownership, or actual isolated storage behavior. Those require distinct live evidence and tests.

## Run locally

```powershell
node scripts/verify-preview-lifecycle-contract.js . "$env:TEMP\autolearnpro-preview-contract\report.json"
```

The GitHub Actions workflow `cloudflare-preview-lifecycle-contract.yml` automatically checks proposed changes to preview contracts and uploads a nonsecret validation report. No Cloudflare credentials are needed, and it never deploys or deletes previews.

## Next work

Collect verified PR-to-live-preview associations, including preview IDs, actual Worker ownership, and dates, then test isolation in a nonproduction preview. Only after that should a separate approved cleanup action evaluate historical resources. Never infer eligibility from a merged PR, name match, absence of analytics groups, or empty object enumeration alone.
