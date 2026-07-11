fix: load OBD2 student scenario data scripts before workflow initialization

Summary

- Ensure scenario data is loaded before the OBD2 student workflow script runs.
- Add explicit script tags for shared scenario sources used by the workflow.

Why

The OBD2 student page depends on scenario datasets and registry mappings at startup. Without loading these dependencies first, workflow initialization can run with missing data.

What changed

- Updated `dashboard/obd2-student.html` to load dependencies in this order:
  - `/data/scenarios.js`
  - `/data/scenario-registry.js`
  - `/dashboard/obd2-student.js`

Testing

- Validated branch diff vs `main` and confirmed this change is isolated to `dashboard/obd2-student.html`.
- Manual smoke path to verify:
  - Open the OBD2 student workflow page.
  - Confirm scenario selector populates as expected.
  - Confirm no missing-data errors in console during initial load.

Files of interest

- `dashboard/obd2-student.html`

How to open the PR

1. Commit and push this branch:

```bash
git add dashboard/obd2-student.html PR_BODY.md
git commit -m "fix: load OBD2 student scenario data before workflow init"
git push -u origin fix/obd2-student-data-scripts
```

2. Create the PR:

```bash
gh pr create --title "fix: load OBD2 student scenario data scripts before workflow initialization" --body-file=PR_BODY.md --base main --reviewer 73junito
```
