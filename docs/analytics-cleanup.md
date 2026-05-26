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
- Run the dedicated analytics/smoke test scripts for the area you changed (for example, the relevant `npm run test:analytics*` script and `torquemind-api: npm run test:smoke`) instead of relying on root `npm test`, which only runs Jest `**/tests/**/*.spec.js` matches
- When smoke workflows need to be re-run to republish the required `api-smoke` status, follow `docs/ci-contract.md` and re-run them from the GitHub Actions UI

Next steps (this PR)
---------------------
- This PR documents the plan and initial audit. Subsequent PRs will implement the checklist items one-by-one.
