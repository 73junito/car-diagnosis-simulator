## Unreleased

- refactor: move global fetch patch into `apiClient.js` and guard installation to avoid multiple patches
- refactor: replace direct API `fetch()` calls with `apiGet`/`apiPost` fallback wrappers
- feat: add robust `studentProfile` initialization to avoid runtime errors
- feat: add richer `getLearningInsightsForClass()` aggregation (weak systems, misconceptions, reasoning trend)
- test: improve UI smoke test script and remove DOM-injection fallback

## 0.1.0 - TBD
- Initial project files
