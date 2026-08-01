Cloudflare production rollout notes

This document describes the initial production hardening steps for the TorqueMind
Cloudflare Worker that replaces the Vercel tutor handler.

Goals
- Reject localhost and private-network AI providers in production.
- Require explicit API keys for OpenAI-compatible providers in production.
- Enforce bounded timeouts and sensible defaults.
- Maintain an allowlist of supported providers.
- Avoid logging secrets or API keys.
- Provide safe configuration diagnostics (provider, model, host metadata only).

Rollout guidance
1. Deploy worker behind Cloudflare with secrets stored in Workers secrets or environment variables.
2. Enable strict validation by setting `NODE_ENV=production` in the Worker environment bindings.
3. Run smoke tests hitting the Cloudflare endpoint and verify responses for a small sample of scenarios.
4. Monitor observability metrics and errors for a week before retiring the Vercel handler.

Secrets
- Store provider credentials (API keys) using Cloudflare secret bindings. Never commit secrets to the repo.

Contacts
- Engineering: torque-dev-team

Rate limiting
- Add rate-limiting middleware to protect the tutor endpoint. Defaults:
	- `TORQUEMIND_RATE_LIMIT_MAX=10`
	- `TORQUEMIND_RATE_LIMIT_WINDOW_SECONDS=60`
	The middleware hashes client identifiers (no raw IPs in logs) and emits `torquemind.feedback.rate_limited` events when limits are exceeded.

Durable Objects (production)
- Production deployments use a Durable Object binding `TORQUEMIND_RATE_LIMITER` backed by the `TorqueMindRateLimitCounter` class to enforce cross-isolate rate limits. Enable with the `USE_DO_RATE_LIMIT` env var (set to `true` in production). If the DO binding is missing while `USE_DO_RATE_LIMIT=true`, the worker will return `503` to avoid silently weakening enforcement.
