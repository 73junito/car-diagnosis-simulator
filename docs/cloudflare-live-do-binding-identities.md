# Live Durable Object Binding Identity Verification

This read-only GET-only tool queries the live settings endpoint for the six known Workers, extracts Durable Object binding names, class names and exact `namespace_id` fields, then reconciles those IDs with a fully paginated historical namespace inventory. No secrets or API raw bodies are retained. It never deploys or deletes resources.

On October 17, 2026, all six live Worker settings endpoints succeeded. Five Worker rate-limit bindings matched namespace IDs in the captured 500-record inventory: production app, staging app, public, legacy simulator and legacy simulator staging. Exam has no live DO binding. These observations establish current Worker binding IDs, not preview-to-namespace ownership or storage deletion eligibility.

To reproduce: supply temporary `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` environment variables and run `node scripts/verify-live-do-binding-identity.js INVENTORY.json OUTPUT.json`. Keep generated reports outside the repository and never commit credentials.

All results have `deletion_authorized: false`. Historical preview identities require separate Cloudflare control-plane evidence. No inferred relationship from namespace name alone is sufficient.
