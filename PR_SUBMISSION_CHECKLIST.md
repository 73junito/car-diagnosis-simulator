# PR Submission Checklist

## Pre-flight

- `npm test` passes locally
- CI workflow passes
- No `nock` imports remain in repository
- `npm run lint:tests` (or `lint:tests`) passes
- Husky pre-commit hooks execute successfully

## Included in This PR

### Reliability

- GitHub client retry/backoff support
- Timeout handling
- Retry observability hooks

### Orchestrator Hardening

- Worker abstraction
- Job-level retries with backoff
- Job idempotency
- Artifact fingerprinting and deduplication

### Persistence & Recovery

- Pluggable checkpoint store
- File-backed checkpoint implementation
- Replay CLI support

### Observability

- Explicit event propagation
- `onEvent`, `onAttempt`, `onFinal`
- Artifact skip events
- Aggregated metrics in final job payloads
- Observability documentation
- Playground example

### Testing

- Worker retry tests
- Replay tests
- Integration coverage
- Partial-failure recovery scenarios

## Reviewer Focus Areas

1. Worker retry semantics and checkpoint updates
2. Artifact deduplication behavior
3. Replay workflow and checkpoint persistence
4. Event propagation and observability APIs
5. Backward compatibility of existing orchestration flows

## Follow-Up Candidates

- Concurrent worker execution
- Redis/SQLite checkpoint adapters
- OpenTelemetry integration
- Prometheus exporter
- Checkpoint TTL cleanup

---

The codebase is in a review-ready state: documentation, tests, replayability, checkpointing, deduplication, retries, and observability are in place and covered by the test suite.
