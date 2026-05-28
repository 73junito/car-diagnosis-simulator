# Version-Sync Cleanup — Plan

This draft outlines the cleanup and stabilization work for the version-sync system.

Goals
- Ensure version metadata (`public/version.json` / `APP_VERSION`) is produced only during a controlled build step.
- Prevent version-sync code from running in non-browser environments or Edge runtimes.
- Add tests and graceful fallbacks so missing version info does not fail builds or runtime.

Scope
- `scripts/write-version.js` — create a gated script that writes `public/version.json` only when explicitly invoked (CI or release flow).
- `dashboard/version-sync.js` — make client-only, guard against import in server or edge contexts; avoid `fs` usage; use feature-detection (`typeof window !== 'undefined'`).
- `dashboard/api-client.js` — ensure any version checks are behind runtime guards and do not run at module-import time.

Planned steps
1. Create branch `chore/version-sync-cleanup` from `main`.
2. Add `scripts/write-version.js` implementing a safe gated writer (no-op unless `npm run write-version` or `CI` env).
3. Refactor `dashboard/version-sync.js` to run only on client and wrap file access/requests with try/catch.
4. Update `dashboard/api-client.js` to avoid automatic reload triggers on import.
5. Add unit tests for `version-sync` behavior (mock `fetch` and missing `version.json`).
6. Open this draft PR and iterate until green CI.

Notes
- This PR will be a draft to allow incremental fixes and testing.
- No production changes will be merged until tests pass and reviewers approve.
