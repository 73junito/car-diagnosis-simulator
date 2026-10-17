# Phase 4D — Read-only Durable Object storage evidence

The collector uses Cloudflare's GET `/accounts/{account_id}/workers/durable_objects/namespaces/{id}/objects` endpoint. Each object reports `hasStoredData`, **not stored byte count**. It does **not** query request traffic, verify bindings, or establish preview ownership. The script never creates, invokes, deploys, deletes, or migrates a Worker or Durable Object.

## Local opt-in execution

Obtain the Phase 3E completed `cloudflare-do-namespace-inventory.json` in a temporary directory. Set the existing account ID and a token authorized for *read-only* Workers metadata in your terminal environment (never commit or print the token). Run a bounded sample first:

```powershell
node scripts/collect-do-object-evidence.js "$env:TEMP\autolearnpro-phase3e\cloudflare-do-namespace-inventory\cloudflare-do-namespace-inventory.json" "$env:TEMP\autolearnpro-phase4d\object-evidence.json" 10
```

The default is **10 namespaces**, processed sequentially. Passing `500` explicitly permits processing the complete previously inventoried set, subject to API access and pagination limits. Each page uses GET, has a timeout, and cursor loops or invalid data fail closed. Failed namespaces are reported as failures, never empty objects.

`has_stored_data: false` means all *enumerated* DO objects had `hasStoredData === false`; it **does not mean zero billed bytes**, no requests, no bindings, or safe deletion. Storage bytes and request counts are always `null` unless independently measured; this script does not fabricate them. It outputs a metrics-compatible `namespaces` array for the Phase 4C classifier, with failures separately.

Do not use this result as a deletion authorization. All namespace IDs and metrics are working artifacts: keep them outside the repository.
