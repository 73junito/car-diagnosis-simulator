Title: ADR-001 — Rate-limit storage for TorqueMind tutor endpoint
Status: Proposed
Date: 2026-07-31

Context
- The Worker implements a rate-limit middleware with an in-memory store for tests and local development. In-memory counters are not globally consistent across Cloudflare Worker isolates, so a production backing store is required to enforce limits across all instances.

Options considered

1) Durable Objects
- Pros: native Cloudflare integration, strongly-consistent per-object storage, sequentialized/atomic updates, low-latency local routing within Cloudflare, no external credentials to manage.
- Cons: requires an additional Worker binding, Durable Object class, and operational awareness (scaling, migrations, storage limits).

2) Centralized API + Redis (or managed counter service)
- Pros: familiar primitives, reliable atomic operations (INCR/EXPIRE), can be reused by non-Workers services.
- Cons: external network dependency, credentials, potential latency and operational burden, cost and single point of failure unless highly available.

3) In-memory store (current)
- Pros: trivial, fast, suitable for unit tests and local dev.
- Cons: not cross-isolate; cannot enforce global limits in production.

Decision
- Recommend Durable Objects for production rate-limit enforcement. It provides strong consistency and native routing within Cloudflare, minimizing cross-region latency and eliminating a separate external dependency.
- Keep the in-memory store behind the same store interface for local development and unit tests.

Consequences
- Implement Durable Object class `RateLimitDO` with a compact storage shape (count, expiresAt). Bind it in production environment and wire the middleware to use it when present.
- Update deployment documentation with DO bindings and operational runbooks (monitoring, backfills, storage limits, rollbacks).
