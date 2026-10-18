# Durable Object evidence gap reduction (October 17, 2026)

The inspection collector now accepts an array of historical inspection reports in either original `{evidence:{namespaces}}` format or expanded `{entries}` format. Only complete object enumeration counts as inspected; existing live Worker namespace IDs remain excluded, and API failures remain unresolved. All operations use GET and deletion is never authorized.

Read-only 100-namespace run: 98 successful object enumerations, two HTTP 404 failures, and zero observed stored-data objects within successful enumerations. Combining these with the previous 60 complete inspections yields 158 complete historical namespace records in the evidence register. The 500-record register classifies five current Worker-bound namespaces, 337 requiring storage inspection, and 158 requiring independent preview ownership verification. Two failed inspections remain unresolved within the 337.

Cloudflare namespace IDs and preview IDs remain different identifiers. None of the 158 completed storage checks establishes absent traffic or preview dependency. Before considering cleanup, obtain independently corroborated preview namespace ownership and retention evidence. No cleanup is authorized.

To reproduce, supply all prior reports as a JSON array in PREVIOUS.json to `node scripts/collect-do-evidence-batches.js INVENTORY DEPENDENCIES LIVE_BINDINGS PREVIOUS OUTPUT 100`, and pass the resulting file with prior batches to `node scripts/build-do-evidence-register.js`.
