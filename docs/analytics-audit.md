# Analytics Audit — summary

This file records the audit performed by the analytics-cleanup work (branch: `chore/analytics-cleanup`). It summarizes findings, risks, and a recommended refactor order so reviewers have a concise reference.

Files inspected

- `api/analytics/sessions.js` — aggregates session reports from `reports/` (JSON or CSV). Exports serverless handler, `aggregateSessions`, and `registerSessionsRoutes`.
- `api/analytics/students.js` — builds per-student aggregates from the same report sources. Exports handler + `aggregateStudents`.
- `api/analytics/summary.js` — thin wrapper that calls `aggregateSessions` and returns a compact summary for endpoints.
- `api/analytics/export.js` — serves CSV/JSON report files from `reports/`.
- `api/telemetry/*` — streaming ingest (`stream.js`), in-memory events queue (`events.js`), optional Supabase adapter (`storage.js`), history & export routes (`history.js`, `export.js`), and access audit helper (`access.js`).
- `tools/telemetry.js` — CLI helper that appends a telemetry sample to `reports/telemetry-events.json` when run as a script.
- `js/analytics.js` — frontend telemetry shim that prefers a bridge (`window.__torquemind_track`) or `navigator.sendBeacon`.
- `dashboard/analytics.js` and `dashboard/session-history.js` — dashboard UI code that fetches the analytics and telemetry endpoints and attaches live telemetry UI.

Key findings

- No dangerous parse-time IO in `api/analytics/*` or `api/telemetry/*`; handlers perform FS/DB access when called, making server-side unit tests possible.
- Frontend modules (`dashboard/*`, `js/analytics.js`) register `DOMContentLoaded` and perform initial fetches — import-time behavior that complicates unit testing and SSR. These should be converted to explicit `init()` functions.
- There are multiple telemetry storage approaches in use: in-memory emitter (`api/telemetry/events.js`), optional Supabase adapter (`api/telemetry/storage.js`), and a CLI file writer (`tools/telemetry.js`). These should be unified behind a single adapter interface.

Risks

- Mixed storage backends can lead to inconsistent behavior between local development, preview, and production (Supabase vs in-memory vs file).
- Import-time DOM side effects in dashboard code make it fragile in test/SSR environments.
- API response shapes are not fully normalized across endpoints — dashboard code does defensive checks; normalizing shapes will simplify consumers.

Recommended safe refactor order

1. Add unit tests for `aggregateSessions` and `aggregateStudents` (low risk). These lock current behavior.
2. Introduce a `lib/telemetry` interface and adapter pattern (in-memory adapter + Supabase adapter) and wire `api/telemetry/*` to it (medium risk).
3. Consolidate `tools/telemetry.js` to use the same adapters (low risk).
4. Refactor frontend dashboard modules to remove import-time side effects; export explicit `init()` functions and call them from page entrypoints. Add unit tests for `sanitizePayload` and `buildExportUrl` (medium risk).
5. Add integration smoke tests for analytics and telemetry endpoints using the adapter interface (medium risk).

Next actions

- This branch will add this audit doc and low-risk unit tests for `aggregateSessions` and `aggregateStudents` to stabilize behavior before larger changes.
