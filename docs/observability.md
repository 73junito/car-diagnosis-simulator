# Observability & Telemetry

This document describes the pipeline and worker observability conventions used by the job/runtime codebase: `onEvent` event types, payload shapes, correlation IDs, checkpointing, replay usage, and the environment variables that tune GitHub network behavior.

## 1. Correlation / Job IDs

- Every top-level run is assigned a `jobId` (string) and threaded through `runPipeline` and the worker runtime. Consumers should correlate logs/metrics by `jobId`.
- `onEvent` calls should include `jobId` when available. Example: `{ jobId, type, ts, payload }`

## 2. `onEvent` event types

The pipeline emits structured events via the `onEvent` callback. Common event `type` values:

- `request.start` — a network request was started
- `request.retry` — a request attempt that failed and will be retried
- `request.success` — a request completed successfully
- `request.failure` — a request failed and will not be retried (or final failure)
- `artifact.skipped` — an artifact was skipped by the pipeline (non-fatal)
- `job.attempt` — worker `onAttempt` hook, emitted per attempt
- `job.final` — worker `onFinal` hook, emitted when the job reaches terminal state

## 3. Event common envelope

All events follow a small common envelope to make consumers simple:

```json
{
  "ts": "2026-06-07T12:34:56.789Z",
  "jobId": "job_20260607_ab12",
  "type": "request.start",
  "node": "worker-1",
  "payload": { ... }
}
```

`node` is optional and useful when running multiple worker processes.

## 4. Request event payload examples

- `request.start` payload:

```json
{
  "method": "GET",
  "url": "https://api.github.com/repos/x/y/actions/artifacts",
  "attempt": 1,
  "id": "req-abc123"
}
```

- `request.retry` payload adds error and next-delay:

```json
{
  "id": "req-abc123",
  "attempt": 2,
  "error": "ETIMEDOUT",
  "nextDelayMs": 1200
}
```

- `request.success` payload includes status and timing:

```json
{
  "id": "req-abc123",
  "status": 200,
  "durationMs": 312
}
```

- `request.failure` payload includes final error:

```json
{
  "id": "req-abc123",
  "status": 504,
  "error": "GatewayTimeout",
  "attempts": 5
}
```

## 5. Artifact events and counters

- `artifact.skipped` payload (non-fatal — pipeline continues):

```json
{
  "artifactId": 402,
  "reason": "downloadFailed", // one of: downloadFailed, missingOrUnreadable, invalidSchema, duplicate
  "error": "Error: unexpected end of file",
  "fingerprint": "sha256:..."
}
```

- Aggregate counters returned by `runPipeline` (example final result):

```json
{
  "processedArtifacts": 12,
  "skippedArtifacts": 3,
  "skippedReasons": {
    "downloadFailed": 1,
    "missingOrUnreadable": 1,
    "duplicate": 1
  },
  "artifactHashes": [],
  "candidates": [ /* domain results */ ]
}
```

These fields were added to make it easy for callers to emit a single job-level metric for data-quality issues.

## 6. Worker lifecycle hooks

- `onAttempt(attemptMeta)` — emitted at the start (or end) of each attempt. Contains `attempt` number, `jobId`, and snapshot metadata.
- `onFinal(finalMeta)` — emitted when the job reaches a terminal state (success or final failure). Contains `status`, `result` or `error`, `attempts`.

Example `onFinal` payload:

```json
{
  "jobId": "job_20260607_ab12",
  "status": "success",
  "attempts": 2,
  "result": { "candidates": [...] }
}
```

## 7. Retry semantics

- Retries obey configurable options (environment variables, see below) and use exponential backoff with jitter. Each retry emits `request.retry` events.
- Transient HTTP 5xx and network errors are retried. 4xx responses are treated as non-retriable unless explicitly whitelisted by code.

## 8. Checkpointing behavior

- The pipeline persists durable checkpoints via the `FileCheckpointStore` by default. Checkpoints live under the repo in `.checkpoints/` and are stored in a JSON file (for developer runs):

```
.checkpoints/checkpoints.json
```

- Checkpoint keys used by the pipeline include `artifact:<fingerprint>` for dedupe and `job:<jobKey>:final` for terminal job state. Tests should clean or isolate these keys when needed.

**⚠️ Concurrency & Checkpoint Safety**

The current file-backed `FileCheckpointStore` implementation is intended for single-writer developer or CI runs. It does not provide cross-process advisory locks or per-key atomic updates and therefore is not safe for concurrent worker processes without an external coordinator (database, Redis, or filesystem locking).

For production deployments consider migrating to a small durable store (SQLite/LevelDB/Postgres) or add a per-key lease/lock before starting a job. This PR intentionally does not change storage implementation — it documents the current single-writer assumption so reviewers and operators are aware.

## 9. Replay CLI

There is a small replay helper to re-run a job from a checkpoint. Usage (example):

```bash
# replay a job by id
node scripts/replay-job.js --jobId job_20260607_ab12

# replay and force a fresh run (ignore final checkpoint)
node scripts/replay-job.js --jobId job_20260607_ab12 --force
```

If `--force` is supplied the script will clear the `job:<jobKey>:final` checkpoint and re-run the job; otherwise the CLI will refuse to re-run a job that has a final checkpoint to preserve idempotency.

## 10. Environment variables (GitHub/network tuning)

- `GITHUB_MAX_RETRIES` — integer. Default used by worker to limit retries for transient GitHub/network errors.
- `GITHUB_TIMEOUT_MS` — per-request timeout in milliseconds.
- `GITHUB_RETRY_BASE_MS` — base backoff in milliseconds used when calculating exponential backoff.

These are read at runtime and override defaults so CI and operator-run systems can tune for their environment.

## 11. Observability best-practices

- Thread `jobId` through logs and events so tracing systems can join events from multiple components.
- Emit `artifact.skipped` for data-quality issues; prefer skipping rather than failing the whole job unless the user explicitly configured `failOnBadArtifact`.
- Aggregate `skippedReasons` at the job level and emit once in `onFinal` to keep downstream metrics ingestion simple.

## 12. Appendix — sample run flow

1. `runPipeline({ onEvent })` assigned `jobId` and emits `request.start` for artifact listing.
2. For each artifact: attempt `downloadArtifactJson` with retries; on transient failures emit `request.retry` then `request.failure` on final failure.
3. If an artifact is invalid, emit `artifact.skipped` and increment `skippedReasons`.
4. Persist checkpoint `artifact:<fingerprint>` when artifact processed successfully to dedupe future runs.
5. On job completion emit `job.final` containing aggregated counters.

---

If you want, I can also (A) add a small `examples/observability-playground.js` snippet that registers an `onEvent` collector and prints concise metrics, or (B) follow up by wiring aggregated skip counters into `job.final` events so they appear in the top-level `onFinal` payload. Which should I do next?
