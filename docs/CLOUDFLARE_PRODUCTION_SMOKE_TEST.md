Cloudflare Production Smoke-Test Checklist

Purpose
- Verify the Cloudflare Worker tutor endpoint is safe, functional, and observable before retiring the Vercel handler.

Prerequisites
- Deployed Worker with correct environment bindings and secrets configured (see `docs/CLOUDFLARE_PRODUCTION.md`).
- Secrets: provider API keys in Cloudflare secret bindings.
- Bindings: any Durable Object or KV bindings selected for production rate-limiting (if chosen).

Checks
- `/api/health` returns 200 and a small JSON health object.
- A valid tutor request returns 200 and the expected tutor JSON shape.
- An invalid/malformed request returns 400.
- Unsupported provider returns 503 (and safe diagnostics are recorded).
- AI provider timeout results in 504.
- Reaching the configured rate limit returns 429 with JSON payload:
  {
    "error": "Too many TorqueMind tutor requests",
    "retryAfterSeconds": <n>
  }
- `x-request-id` is present on responses and stable across retries.
- Logs emitted for requests do NOT contain prompts, student answers, correct answers, API keys, authorization headers, or raw client IPs. Check that logs only include: requestId, route, method, status, durationMs, provider, model, and provider host (hashed/truncated client id only where necessary).
- Observability: verify `torquemind.feedback.started`, `torquemind.feedback.completed`, `torquemind.feedback.failed`, and `torquemind.feedback.rate_limited` events are delivered to your logging/monitoring sink.

Rollback and recovery
- If any critical smoke test fails, revert Worker to the previous release and keep the Vercel handler active.
- Keep the Vercel handler reachable and document the steps to revert DNS / traffic routing.

Post-deploy monitoring
- Monitor errors and rate-limited events for a minimum of 72 hours.
- Success criteria: steady error rate within expected baseline, no unexplained provider failures, and acceptable latency percentiles.
