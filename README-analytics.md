# Analytics Sample Bundle

This bundle provides sample analytics artifacts generated from instructor telemetry and validation tooling. Use these files to preview or import analytics into dashboards or LMS/xAPI endpoints.

Included files:

- `student-performance.csv` — instructor-facing CSV export of aggregated session metrics.
- `xapi-statements.json` — xAPI statements derived from telemetry events.
- `scenario-validation-report.json` — AJV scenario validation report used during CI.

Usage:

1. Download and unzip the bundle.
2. Inspect `student-performance.csv` for per-session and per-student metrics.
3. POST `xapi-statements.json` to an LRS endpoint for import/testing.
