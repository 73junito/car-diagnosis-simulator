Changelog (unreleased)
======================

Date: 2026-06-07
Author: automated PR draft by maintainer tooling

Summary
-------
Hardens the regression-issue orchestration pipeline with durable worker execution, retry/backoff, checkpointing and replay, artifact deduplication, and richer observability. Adds documentation and a demo playground.

Highlights
----------

- Worker runtime (`lib/worker.js`) with retry/backoff and idempotency.
- Persistent checkpoints and replay CLI (`.checkpoints/*`, `scripts/replay-job.js`).
- Artifact fingerprinting and deduplication (SHA-256).
- Observability: `onEvent`, `onAttempt`, `onFinal` hooks; `artifact.skipped` events; aggregated `metrics` in final payload.
- `docs/observability.md` and `examples/observability-playground.js` added.

Migration notes
---------------

- No breaking API changes expected. If you run the pipeline manually or in CI, consider setting:

  - `GITHUB_MAX_RETRIES` — to tune retry counts for your environment.
  - `GITHUB_TIMEOUT_MS` — per-request timeout.
  - `GITHUB_RETRY_BASE_MS` — base backoff for exponential retries.

Developer notes
---------------

- Tests are deterministic but may interact with the file-backed checkpoint store. Tests that rely on a pristine state delete relevant checkpoint keys; replicate the same pattern in CI if needed.
