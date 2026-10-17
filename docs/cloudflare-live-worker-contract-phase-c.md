# Phase C — Live Worker configuration and secret-binding verification

The collector queries Cloudflare `GET /accounts/{account_id}/workers/scripts/{worker}/settings` for all six expected Worker names. It **never uses PUT, POST, PATCH, DELETE, or deployments**. Its output allowlists only names, binding types, and three non-secret feature flags; raw API responses and secret material must not be saved.

## Execution (locally, with existing Wrangler authorization)

Supply `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as temporary environment variables. Keep the credential out of files, shell history, logs and Git.

```powershell
node scripts/collect-live-worker-metadata.js "$env:TEMP\autolearnpro-phase-c\live-worker-metadata.json"
node scripts/compare-live-worker-contract.js . "$env:TEMP\autolearnpro-phase-c\live-worker-metadata.json" "$env:TEMP\autolearnpro-phase-c\comparison.json"
```

Read-only live inspection on 2026-10-17: all six settings requests succeeded. The main app exposes `TORQUEMIND_RATE_LIMITER`, a `SEMANTIC_SCHOLAR_API_KEY` Secrets Store binding, and enabled Semantic Scholar flag. The exam Worker has no Durable Object binding. Legacy Workers remain separate. The app staging Worker has no live Secrets Store binding, while the Phase A configuration contract sees a top-level binding inherited from `wrangler.app.jsonc`. **Investigate whether the staging absence is intentional: the staging Semantic Scholar flag is disabled in the repository. Never copy production secrets to staging by default.**

Comparison outcomes: one binding mismatch requiring policy review, four partially verified Worker configurations (routes cannot be inspected via this settings API), and one legacy Worker requiring manual ownership review. No Worker is claimed fully verified.

**Limitations:** This endpoint does not establish Worker route mappings, deployment-to-commit provenance, live preview inheritance, or secret functionality. Secret binding presence does not demonstrate upstream API success. Follow up with read-only route queries and post-deployment smoke tests, not automatic configuration changes.
