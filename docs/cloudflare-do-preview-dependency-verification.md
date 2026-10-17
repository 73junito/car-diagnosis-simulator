# Durable Object and Preview Dependency Verification

This read-only offline report joins previously collected Durable Object namespace inventory, 31-day requests analytics, sampled object enumeration, and PR preview ownership/retention manifests. It never invokes, creates, deploys, migrates or deletes a Durable Object. **No deletion is authorized.**

## Reconciliation boundaries

Namespace IDs and Cloudflare preview IDs are not interchangeable. A derived name such as `autolearnpro-app_<branch>_TorqueMindRateLimitCounter` yields only a **heuristic** association, even when the preview ID itself was independently confirmed against a Cloudflare Builds record. Each namespace needs independently verified binding references, storage dependencies and application ownership before any cleanup decision. Missing analytics groups do not indicate zero requests, and incomplete object enumeration does not indicate zero stored data.

## October 17, 2026 snapshot

- 500 namespace inventory records, six named permanent-environment records (some may be legacy).
- 436 namespace-name matches to preview branches, **not** 436 proven dependencies.
- 58 unmatched namespace records, requiring independent inspection.
- Five sampled namespaces were confirmed to contain stored data.
- Storage object enumeration is incomplete or unavailable for 492 namespaces.
- Zero deletions authorized.

Inputs are snapshots with different observation times. The 549-preview audit is not a one-to-one inventory of the 500 namespace records, and the analytics request table contains unknown groups; never equate counts.

## Reproduce using previously obtained local evidence

Run `node scripts/verify-do-preview-dependencies.js INVENTORY.json REQUESTS.csv OBJECTS.json OWNERSHIP.json RETENTION.json OUTPUT.json`. Output is local, not committed to Git. The program requires all five sources and fails if the underlying namespace correlation detects incomplete inventory or malformed evidence.

## Next verification

Acquire authenticated read-only Worker binding and Preview-to-namespace ID evidence from the Cloudflare control plane, and extend bounded object checks for specifically approved inspection batches. Keep all permanent, ambiguous, storage-bearing and unverified records protected. Do not implement bulk deletion or automatic cleanup from this report.
