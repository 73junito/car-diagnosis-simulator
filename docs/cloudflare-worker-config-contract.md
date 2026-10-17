# Cloudflare Worker Configuration Contract — read-only Phase A

Run from the repository root:

```powershell
node scripts/audit-worker-config-contract.js . "$env:TEMP\autolearnpro-worker-config-contract\report.json"
```

The report covers six historically deployed Worker names. Five are declared in Wrangler files; `car-diagnosis-simulator` is legacy and needs manual ownership and routing review. Staging resolves explicitly to the modern app environment or the legacy public-config staging environment. The script reads repository configuration only; **it does not connect to Cloudflare, deploy, fetch secrets, change bindings, or delete resources**.

Optionally supply a third argument pointing to a JSON array of prevalidated read-only *live metadata* objects; names must match Worker names. The comparator accepts routes, durable_object_bindings, secrets_store_binding_names, and flags. All missing live fields are unverified and cannot be reported as matching. Do not add secret values to the input. Secret Store entries in this report include binding names only (not secret identifiers or contents).

Known risks: `scripts/deploy-and-test-staging.ps1` implicitly targets the old staging Worker through default `wrangler.jsonc`; `wrangler.app.jsonc` defines a separate app staging Worker. The app config disables Semantic Scholar in previews and staging and enables it in production. The public Worker has a DO binding and a historical SQLite migration; never remove either without a separate storage-safe migration review. The exam Worker has no current DO binding.

Follow-on work must collect and verify live Cloudflare Worker metadata **without printing credentials**, establish route and deployment provenance, pin explicit config paths for staging scripts, and run current post-deployment smoke tests. This first phase intentionally reports the live Worker contract as unverified rather than guessing.
