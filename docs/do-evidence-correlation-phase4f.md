# Phase 4F — Conservative namespace evidence correlation

This is an offline, read-only join of the verified 500-namespace inventory, Cloudflare GraphQL request analytics CSV, and the bounded Durable Object object-list evidence sample. No Cloudflare write operations, deployments, or migrations.

```powershell
node scripts/correlate-do-usage-evidence.js <inventory.json> <requests.csv> <object-evidence.json> <output-directory>
```

The output `do-evidence-correlation.json` retains unknown analytics as null, 404 object-list responses as failed evidence, and every namespace's preview ownership and binding state as unverified. All base Worker namespaces remain protected. Every row has `deletion_authorized: false`.

For the October 17 evidence set: 500 namespaces; 1 measured 31-calendar-day analytics request count, 499 missing analytics groups; 8 completed object-list checks; 2 HTTP 404 object-list failures; 6 protected namespaces. The current analytics dataset's retention window covers September 17–October 17, 2026, but sampled analytics cannot certify inactivity where a group is absent.

**Important:** This does not establish which previews own namespaces, or that any namespace is unused. Do not infer zero requests from an absent group, zero bytes from an empty object list, or unbound status from historical naming. Before retirement, verify current and historical Worker bindings, ownership, and rollback with separate live read-only evidence. Keep the raw output in a temporary directory, not the repository.
