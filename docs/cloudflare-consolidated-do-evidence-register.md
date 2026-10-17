# Consolidated Durable Object Evidence Register

This read-only offline report joins the complete Cloudflare namespace inventory, request/ownership dependency report, exact live Worker binding IDs, and completed object-inspection batches. It deduplicates namespace names, detects conflicting snapshots, and keeps the entire register deletion-ineligible. It does not mutate Cloudflare.

Usage: `node scripts/build-do-evidence-register.js INVENTORY.json DEPENDENCIES.json LIVE_BINDINGS.json OUTPUT.json BATCH1.json [BATCH2.json ...]`

October 17, 2026 local snapshot: 500 namespace records; five namespace IDs currently bound to Workers; 60 distinct completed historical inspections; 435 still prioritized for object inspection; 60 need independent preview ownership verification; zero deletions authorized. Two batch reports supplied (first ten and next fifty). Missing traffic groups remain unknown; observed empty object lists do not prove a namespace inactive. Any conflicting batch observations are flagged for investigation rather than silently overwritten.

Keep generated register evidence outside Git. Before cleanup eligibility can be considered, independently verify preview ID-to-namespace ownership, Worker bindings, storage dependencies, and retention approval. Never delete namespaces based solely on this report.
