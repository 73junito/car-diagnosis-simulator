Phase 3: Orchestrator Hardening, Replayability, and Observability
===============================================================

Summary
-------
This PR hardens the automated regression-issue orchestration pipeline used by CI. It adds a lightweight worker runtime with durable job execution patterns, retry-safe processing, checkpointing and replayability, artifact deduplication, and end-to-end observability.

Branch: `feature/student-dashboard-enhancements`

Highlights
----------

### Worker framework

- Added `lib/worker.js` — lightweight job abstraction and runner with per-job retries, exponential backoff + jitter, and idempotent execution via deterministic job fingerprints.
- Added `InMemoryQueue` for simple orchestration and `Job` objects used by the runner.

### Checkpointing & replay

- Introduced pluggable checkpoint store API (`core/checkpoint`) with a file-backed store used in developer runs.
- Persist job attempts, job snapshots, artifact fingerprints (`artifact:<hash>`), and `job:<key>:final` terminal markers to enable safe restarts and replays.
- Added `scripts/replay-job.js` and replay CLI glue.

### Artifact deduplication

- Compute SHA-256 fingerprints for artifact ZIPs and dedupe at two levels: per-run and persisted checkpoints to avoid duplicate processing across restarts.

### Observability

- Thread `onEvent` through worker -> pipeline -> network layers to avoid global mutable hooks.
- Add structured events: `request.start`, `request.retry`, `request.success`, `request.failure`, `artifact.skipped`.
- Add lifecycle hooks: `onAttempt`, `onFinal`.
- Aggregate artifact counters and reasons and include them in the terminal `onFinal` payload under `metrics`.
- Added documentation `docs/observability.md` and a runnable demo `examples/observability-playground.js`.

### GitHub client resilience

- Standardized network calls via `doFetch(...)` so tests and runtime observe consistent WHATWG `Response` shapes.
- Added retry awareness hooks, configurable timeout, and environment tuning: `GITHUB_MAX_RETRIES`, `GITHUB_TIMEOUT_MS`, `GITHUB_RETRY_BASE_MS`.

Testing
-------

Coverage added and validated locally:

- Worker retry behavior (`tests/unit/worker.retry.spec.js`)
- Worker integration (`tests/integration/worker.integration.spec.js`)
- Partial-failure scenarios (`tests/integration/auto-open.partial-failures.integration.spec.js`)
- Multi-artifact orchestration flows and end-to-end issue create/reopen flows

Current status: 65 test suites passing, 210 tests passing (local run).

Files of note
-------------

- `lib/worker.js` — worker runtime and hooks
- `core/checkpoint/*` — checkpoint store (file-backed + in-memory fallback)
- `scripts/auto-open-regression-issues.js` — orchestration pipeline (artifact handling, issue ops)
- `examples/observability-playground.js` — demo showing `onEvent`, `onAttempt`, `onFinal`
- `docs/observability.md` — event schema, payload examples, replay usage, env var guide

Follow-ups / optional work
-------------------------

- Wire Prometheus/OpenTelemetry exporters for `onEvent`/`onFinal`.
- Add checkpoint TTL and automated cleanup policies for stale artifact fingerprints.
- Add concurrent worker pool implementation to safely run multiple workers in parallel.
- Add a small architecture diagram to `docs/` (mermaid or plantuml).

Notes for reviewers
------------------

- Tests rely on cleaning certain checkpoint keys for isolation — see tests for examples of deterministic cleanup (`checkpoint.delete(...)`).
- The pipeline now prefers skipping malformed/corrupt artifacts and emits `artifact.skipped` events and aggregated counters rather than failing the whole job. This was an explicit choice to prioritize availability and observability.

Suggested reviewers
------------------

- Reviewer(s) familiar with CI automation, network robustness, and observability (owner of `scripts/auto-open-regression-issues.js` and `lib/worker.js`).
