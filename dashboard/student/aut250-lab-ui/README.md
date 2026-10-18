# AUT-250 Student Diagnostic Laboratory (Simulated)

SIMULATED developmental training UI only. No assessment, scoring,
backend, database, or production engine integration.

## Owned paths

- `dashboard/student/aut250-lab-ui/`
- `tests/aut250-student-lab-ui/`

## Preview

Serve the worktree root and open:

`dashboard/student/aut250-lab-ui/index.html`

## Mock adapter contract

`aut250-mock-adapter.js` exposes:

`session()`, `record(type, payload)`, `test(id)`,
`repair(id)`, `exportEvidence()`.

## Integration assumptions

- Real engine (`engine/aut250MisfireLab.js`, PR #1049) is untouched.
- Future integration replaces the mock module only.
- No scoring endpoints or tables are invented here.
