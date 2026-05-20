# Changelog

## [Unreleased]

- Scenario Schema v1.2
  - Add `schemaVersion: "1.2"` and `scoringWeights` defaults.
  - Enforce `requiresSafetyAcknowledgment` for high-voltage scenarios.
  - Validator now enforces `scoringWeights` totals equal 100.
  - Add example EV/high-voltage scenario (requiresSafetyAcknowledgment: true).
- Added Vercel rewrite for `/dashboard/analytics`.
- Confirmed `/dashboard/analytics` returns HTTP 200 after deployment.
- Confirmed `/dashboard/analytics/` redirects correctly with HTTP 308.
- Merged Dependabot `babel-jest` update after syncing lockfile.
- Fixed `hero.js` Jest failure by ensuring activation state variables are declared.
## 0.1.1 - Stable

### Highlights

* Replaced prompt-based teacher authentication with a modal sign-in flow.
* Added keyboard accessibility:

	* Enter submits login form
	* Escape closes modal
* Converted major teacher dashboard interactions away from inline `onclick` handlers to `addEventListener`.
* Added centralized API layer:

	* `auth.js`
	* `apiClient.js`
* Moved global fetch authorization patch into `apiClient.js` with guarded installation.
* Replaced direct API `fetch()` calls with `apiGet()` / `apiPost()`.
* Added persistent global `studentProfile` initialization.
* Rebuilt `getLearningInsightsForClass()` with:

	* system weakness aggregation
	* misconception aggregation
	* reasoning trend calculations
* Fixed replay viewer rendering and visibility issues.
* Added stronger replay diagnostics and smoke-test validation.
* Expanded Puppeteer UI smoke tests to validate:

	* teacher modal
	* replay viewer
	* scenario preview/start
	* dashboard rendering

### Stability

* `node --check script.js` passes.
* Headless smoke tests pass with no runtime errors.
* Replay viewer verified visible in automated tests.
* Main branch verified clean before release tag.

### Architecture Direction

Current modularization path:

* `auth.js`
* `apiClient.js`
* future:

	* `teacherDashboard.js`
	* `replayEngine.js`
	* `recommendationEngine.js`
	* `scenarioRenderer.js`

### Tag

* Release tag: `v0.1.1`

## 0.1.0 - TBD
- Initial project files
