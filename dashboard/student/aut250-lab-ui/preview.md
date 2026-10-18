# Local preview — AUT-250 Student Lab (Simulated)

Worktree: `F:\TorqueMind-aut250-student-lab-ui`
Branch: `feat/aut250-student-lab-ui`
Entry: `dashboard/student/aut250-lab-ui/index.html`

## Fast checks already run

- `node --check` passed for all new JS/test files.
- Mock workflow: `MIL on -> OL -> wrong repair false -> coil repair true -> MIL off`.
- Jest isolated: `3 suites passed, 8 tests passed`.
- DOM checks: skip link, `aria-live`, scope canvas, hypothesis, repairs, SIMULATED label.

## Manual preview

1. Serve only this worktree root.
2. Open the entry file.
3. Click `Read DTCs`, then `Coil secondary`.
4. Enter hypothesis/explanation and save reasoning.
5. Try spark-plug repair, then coil repair.
6. Export simulated evidence.

Expected: responsive two-column workstation collapsing to one column,
keyboard focus visible, status announcements for every action.
