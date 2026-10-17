# Phase 4C — Durable Object zero-storage audit (read-only)

This **offline** classifier operates on the Phase 3E namespace-inventory artifact. It does **not** query, update, migrate, deploy or delete Cloudflare resources. A namespace inventory contains no byte usage or request totals, so these values are **unknown** unless an independently verified metrics snapshot is supplied.

## Run

```powershell
node scripts/audit-do-zero-storage.js "<path-to-cloudflare-do-namespace-inventory.json>" - "$env:TEMP\autolearnpro-phase4c"
```

The optional second argument is a JSON file with a `namespaces` array of objects keyed by **exact namespace name**:

```json
{
  "namespaces": [
    {
      "name": "autolearnpro-app_feat-example_TorqueMindRateLimitCounter",
      "storage_bytes": 0,
      "requests": 0,
      "has_stored_data": false,
      "active_preview": false
    }
  ]
}
```

Only include numbers and boolean signals that are authoritatively established. `storage_bytes` and `requests` must be non-negative integer measurements. Request counts are meaningful only when accompanied by a documented observation window outside the classifier. The Cloudflare namespace list itself does **not** report these values. The [Cloudflare namespace objects API](https://developers.cloudflare.com/api/resources/durable_objects/subresources/namespaces/subresources/objects/methods/list/) supplies `hasStoredData` per *object*, not a namespace-level byte count; only map it to `has_stored_data` when the objects list has been exhausted and aggregation is justified. Never infer false from an empty or incomplete response.

Outputs: `do-zero-storage-summary.json` and `do-zero-storage-report.md`.

The classification `potential_review_only` requires zero bytes, zero observed requests, negative object-storage evidence, and a verified absent preview; **even then deletion_authorized is always false**. Base and non-application namespaces remain protected regardless of metrics.

Do not commit raw Cloudflare inventory or metrics artifacts, print secret tokens, or turn this classifier into a cleanup executor. Namespace-to-preview ownership and Cloudflare quotas require separate evidence.
