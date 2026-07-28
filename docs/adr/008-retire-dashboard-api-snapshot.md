# ADR 008: Retire the Dashboard Backend API Snapshot

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owners:** TorqueMind maintainers
- **Canonical implementation:** `api/`

## Context

TorqueMind contained two API source trees:

- `api/`
- `dashboard/Backend APIs/`

The second tree was introduced during earlier Windows test and dashboard asset-path work. Repository history identifies two commits associated with that location:

- `5c33ceb` — Fix Windows tests and dashboard asset paths
- `fa3191e` — Fix/windows tests dashboard paths (#185)

An architectural review was conducted to determine whether the dashboard copy remained an active runtime, deployment target, or maintained source tree.

## Evidence

Repository searches found no tracked references to the legacy directory:

```powershell
git grep -n "dashboard/Backend APIs"
git grep -n "Backend APIs"
```

Both commands returned no matches.

A SHA-256 and relative-path comparison against the root `api/` tree showed that the dashboard copy had diverged:

- Several files were byte-for-byte identical.
- Several files were older than their root API counterparts.
- `analytics/cohort.js`, `analytics/heatmap.js`, and `telemetry/replay.js` were empty in the dashboard copy.
- `api/torquemind-feedback.js` existed only in the canonical root API.
- No unique files existed in the dashboard API copy that required migration.

The root `api/` tree therefore represents the current implementation.

## Decision

The root `api/` directory is the single canonical source for Vercel API functions.

The directory `dashboard/Backend APIs/` is classified as an obsolete architectural snapshot and is removed from the repository.

No new development, deployment configuration, tests, or documentation may depend on a second copied API tree.

## Verification

After removal, the following validation completed successfully:

- Jest: 64 of 64 suites passed
- Jest: 214 of 214 tests passed
- Playwright: 4 of 4 tests passed
- Repository searches found no references to the removed path

## Consequences

### Positive

- Establishes one API source of truth
- Eliminates stale and empty files
- Prevents implementation drift
- Reduces maintenance and review overhead
- Clarifies deployment ownership
- Simplifies future API refactoring

### Negative

- The historical snapshot is no longer visible in the working tree.

The removed implementation remains available through Git history.

## Alternatives considered

### Maintain both API trees

Rejected because the trees had already diverged and maintaining synchronized copies would create continued source-of-truth ambiguity.

### Synchronize the dashboard copy

Rejected because no active runtime or deployment configuration referenced it.

### Move the root API into the dashboard

Rejected because the root `api/` directory is the established Vercel API convention and contains the newer implementation.

## Follow-up rules

- API endpoints must be implemented under `api/`.
- Shared logic should be extracted into reusable modules rather than copied into another API tree.
- Any future alternate backend runtime must have an explicit ownership boundary documented through an ADR.
