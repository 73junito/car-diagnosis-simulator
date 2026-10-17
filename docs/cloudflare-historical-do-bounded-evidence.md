# Historical Durable Object bounded storage inspection

This tool uses the existing complete namespace inventory, offline dependency report, and six-Worker live binding evidence to select at most 25 historical namespaces for read-only object listing. It excludes exact namespace IDs currently bound to any of the five rate-limited Workers. It prioritizes namespaces without even heuristic PR-preview associations, but does not treat naming as ownership proof.

Usage: `node scripts/inspect-historical-do-batch.js INVENTORY.json DEPENDENCIES.json LIVE_BINDINGS.json OUTPUT.json [LIMIT]`. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` temporarily. Reports are local and must not contain tokens. No writes or deletes to Cloudflare are performed. The existing collector uses only GET and does not invoke Durable Object application stubs.

October 17, 2026: 492 namespaces lacked complete object-list evidence in the prior snapshot. The first ten selected unresolved namespaces were inspected: ten completed, zero errors, zero observed objects with stored data. This evidence **does not** demonstrate zero requests, absence of live preview bindings, inactivity, or deletion eligibility. The five known production/staging/legacy/public namespace IDs remain protected; exam has no current binding.

Follow-up: obtain authoritative historical preview-to-namespace IDs and broaden bounded inspection only when needed. Preserve all namespaces pending storage, binding, usage and retention review. No deletion authorization is issued by this tool.
