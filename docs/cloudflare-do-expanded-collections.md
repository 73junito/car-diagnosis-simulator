# Expanded historical Durable Object evidence collection

The bounded collector processes at most 100 namespace inspections per execution, internally chunked into batches of at most 25. It excludes current exact live Worker namespace IDs and namespaces previously verified by full object enumeration, prioritizing ownership-unresolved records. Only Cloudflare GET object-list calls are allowed by the underlying inspector; no deployments, migrations, cleanup or deletions occur.

## Snapshot: October 17, 2026

Using the previously captured complete 500-record namespace inventory, read-only dependency report, exact six-Worker live binding report and preceding ten-namespace inspection, an additional 50 distinct historical namespace inspections all completed successfully. No sampled namespace contained an observed stored-data object. The combined two runs cover 60 historical namespace records, but neither run establishes current traffic, preview ownership, namespace deletion eligibility, or ongoing binding absence.

Command: `node scripts/collect-do-evidence-batches.js INVENTORY.json DEPENDENCIES.json LIVE_BINDINGS.json PREVIOUS.json OUTPUT.json [MAX<=100]`. `PREVIOUS.json` accepts a single prior inspection report or an array of them. Keep tokens in temporary environment variables and reports outside Git.

Existing failed inspections remain unresolved, as do untested namespaces. Further calls must retain the explicit bounds, duplicate avoidance and deletion prohibition. Namespace data is not changed by this workflow.
