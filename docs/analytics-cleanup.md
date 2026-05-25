# Analytics Cleanup Plan

Purpose
-------
This document outlines a focused cleanup for the project's analytics layer to improve maintainability, testability, and alignment between server and serverless exports.

Scope
-----
- Telemetry helpers and API wrappers
- `session-history` data flow and export logic
- Express vs serverless export consistency in `api/` and `torquemind-api/`
- Test fixtures and smoke-test alignment for analytics paths

Initial checklist
-----------------
1. Audit analytics surface area (files and exports)
   - `api/analytics/*.js`
   - `js/analytics.js`
   - `tools/telemetry.js`
   - `dashboard/session-history.js`
2. Consolidate telemetry helpers into a single `lib/telemetry` module
3. Replace ad-hoc fetch wrappers with `apiClient` usage where appropriate
4. Simplify `session-history` data flow so it parses and runs under Jest without top-level side effects
5. Add focused unit tests for telemetry helpers and session parsing
6. Add integration smoke tests for `api-smoke` covering analytics endpoints
7. Remove dead or duplicated analytics code

How to review
-------------
- PRs should be small and focused (one area at a time)
- Include test coverage for changed behavior
- Run `npm test` and `gh workflow run` for smoke tests when applicable

Next steps (this PR)
---------------------
- This PR documents the plan and initial audit. Subsequent PRs will implement the checklist items one-by-one.
