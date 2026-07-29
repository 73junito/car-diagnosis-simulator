---
name: offline-sync
description: Implement or review production-grade PWA service workers, Cache API policies, IndexedDB storage, offline mutation outboxes, background synchronization, cache upgrades, and online/offline parity for RALA applications.
license: MIT
metadata:
  author: TorqueMind and Village Strong
  version: "0.1.0"
---

# Offline synchronization skill

- Version every cache.
- Precache from an explicit manifest; do not recursively cache unknown files.
- Never cache secrets or authenticated HTML responses indiscriminately.
- Use network-first for rapidly changing authenticated data.
- Use stale-while-revalidate only for safe public reference assets.
- Use cache-first for immutable versioned assets.
- Queue writes in IndexedDB with an idempotency key.
- Retry with bounded exponential backoff.
- Detect conflicts using a server version, ETag, or equivalent base version.
- Never silently discard a mutation.
- Expose sync status to the UI.
- Support an emergency service-worker unregister and cache-clear path.

Test first install, upgrade, offline navigation, missing cache entries, failed writes, duplicate retry, conflicts, sign-out cleanup, corrupted local records, and reconnection.
