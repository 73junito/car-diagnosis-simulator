Durable Object rate-limit implementation plan

Status: Proposed
Date: 2026-07-31

Summary
- This document defines the implementation contract for using a Cloudflare Durable Object (DO) to enforce cross-isolate rate limits for the TorqueMind tutor endpoint (`POST /api/torquemind-feedback`). The code-level implementation will be delivered in a single focused commit: `feat(worker): add Durable Object rate-limit store`.

Goals
- Enforce per-client rate limits globally across Worker instances.
- Provide an atomic, low-latency counter with predictable reset semantics.
- Preserve existing in-memory store for local dev and tests.
- Fail safely (observable failure mode) if the DO is unavailable.

Durable Object class and binding
- Class name: `RateLimitDO`
- Binding name (wrangler): `RATE_LIMIT_DO`
- File: `worker/durable-objects/rate-limit-counter.js`

Keying strategy for client identifiers
- Middleware computes a canonical `clientKey` (string) using the following precedence:
  1. Authenticated user id (if present in request context)
  2. API key / provider token id (if present and safe to use as identifier)
  3. `x-forwarded-for` first IP, or `cf-connecting-ip` if available
  4. Fallback to `x-request-id` hashed
- The middleware MUST normalize and then hash the chosen identifier using HMAC-SHA256 with a server-side secret (env var name: `TORQUEMIND_HMAC_SECRET`) and then base64url-encode/truncate to 32 chars. This prevents raw IPs or tokens from appearing in logs or being leaked to the object key-space.

Request/response contract between middleware and Durable Object
- The middleware will call the DO via the Durable Object namespace binding using `get(id).fetch(request)` with JSON requests.
- Endpoints supported (HTTP JSON):
  - `POST /increment` body: { "key": "<hashed-client-key>", "windowSeconds": <n>, "limit": <max> }
    response: { "allowed": boolean, "count": number, "remaining": number, "resetAt": <iso-timestamp>, "windowStart": <iso-timestamp> }
  - `GET /status?key=<key>` response identical shape describing current state
  - `POST /bulk-clear` (admin only) to clear any keys for migration/rollback
- Authentication: middleware-to-DO calls occur within the same worker runtime (no external auth). The DO only accepts requests from within the Worker via its bound namespace.

Fixed-window vs sliding-window behavior
- Implementation: fixed-window counter (aligned to epoch/windowSeconds). Rationale: simpler, less state, deterministic reset times. Fixed-window is acceptable given the tutor endpoint rate and expected user patterns.
- Window calculation: `windowStart = Math.floor(now / windowSeconds) * windowSeconds`.

Atomic update semantics
- Use `state.blockConcurrencyWhile(async () => { ... })` in the DO to serialize read/modify/write for each key. Implementation steps:
  1. Read existing entry for `key` from `state.storage.get(key)`.
  2. If entry missing or expired (windowStart differs), set count=0 and windowStart=current windowStart.
  3. Increment count, persist with `state.storage.put(key, entry)` including `expiresAt`.
  4. Return the response payload.

Expiration and cleanup strategy
- Each stored entry carries `expiresAt = windowStart + windowSeconds + graceSeconds` (grace default 5 seconds) to tolerate clock skew.
- Lazy cleanup: reads detect expired entries and remove them.
- Optional maintenance: DO may implement a periodic sweep using `state.storage.list()` in a background alarm (if desired and supported); initial implementation relies on lazy cleanup only.

Failure behavior if the Durable Object is unavailable
- Fail-open policy: if the DO call fails (unreachable, timeout), the middleware will fall back to the in-memory store and emit a structured warning metric/event `torquemind.feedback.rate_limit.do_unavailable` with a hashed client id and request id. Rationale: avoid blocking all users if DO outage occurs; notify ops so remediation can be prioritized.
- The fallback path remains subject to per-worker in-memory limits and is intended for short outages.

Local-development fallback to the current in-memory store
- If `env.RATE_LIMIT_DO` binding is absent or `USE_DO_RATE_LIMIT` feature flag is false, middleware uses the existing in-memory store (same interface) so unit tests and local dev remain unchanged.

Wrangler configuration changes and migrations
- `wrangler.jsonc` changes:
  - Add a `durable_objects` section with `bindings: [{ "name": "RATE_LIMIT_DO", "class_name": "RateLimitDO" }]` for production and staging environments.
  - Add `vars` entries for `USE_DO_RATE_LIMIT` (default `false` in dev, `true` in prod) and `TORQUEMIND_HMAC_SECRET` (secret) in appropriate environments.
- Migration: no existing data to migrate. Deploying the DO will start with empty state. If migrating from an existing centralized store later, provide an offline migration tool that bulk-writes into DOs via the admin `POST /bulk-clear` or set operations.

Test strategy
- Unit tests:
  - `tests/worker-rate-limit-durable-object.test.js` — tests DO logic by mocking `DurableObjectState` (or using Miniflare's DO harness) to exercise `increment` and `status` endpoints across window boundaries.
  - Test atomicity by simulating concurrent `increment` calls against same key via mocked `blockConcurrencyWhile` and ensure consistent final count.
- Integration tests:
  - Run the existing `worker-rate-limit.test.js` suite twice: once with `USE_DO_RATE_LIMIT=false` (in-memory) and once with `USE_DO_RATE_LIMIT=true` under Miniflare/Workers dev that provides DO bindings.
  - Verify headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`, and `x-request-id` preserved.
  - Verify logs do not contain raw IPs or keys; only hashed client ids.

Rollout order and rollback path
1. Create the DO class file and middleware wiring behind a feature flag (no traffic impact). Add tests and docs. (This is the planned commit `feat(worker): add Durable Object rate-limit store`.)
2. Deploy to staging/canary with `USE_DO_RATE_LIMIT=true` and DO binding present on a subset route or subdomain.
3. Run smoke tests (see docs/CLOUDFLARE_PRODUCTION_SMOKE_TEST.md) including cross-isolate rate checks.
4. Monitor metrics and logs for `torquemind.feedback.rate_limit.*` events for 24–72 hours.
5. Gradually enable `USE_DO_RATE_LIMIT` for more traffic. When fully validated, set `USE_DO_RATE_LIMIT=true` in production config permanently.

Rollback
- If problems arise, either:
  - Flip `USE_DO_RATE_LIMIT=false` to return all traffic to in-memory store (fast rollback), or
  - Remove DO bindings and deploy middleware fallback while investigating.

Notes
- Keep the initial DO implementation minimal and well-tested. Defer optional features (sliding-window, persistent metrics, cross-DO sharding) until after production rollout.
