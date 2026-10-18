# Integration handoff — AUT-250 student lab PR #1050

Status: developmental simulation. Do NOT merge, deploy, score, or assess.
Branch: `feat/aut250-student-lab-ui`
PR: #1050, base `main`, remains OPEN.

## 1. Exact files added or modified

Added only:

- `dashboard/student/aut250-lab-ui/index.html`
- `dashboard/student/aut250-lab-ui/aut250-lab.css`
- `dashboard/student/aut250-lab-ui/aut250-lab.js`
- `dashboard/student/aut250-lab-ui/aut250-mock-adapter.js`
- `dashboard/student/aut250-lab-ui/README.md`
- `dashboard/student/aut250-lab-ui/preview.md`
- `dashboard/student/aut250-lab-ui/adapter-compatibility.md`
- `dashboard/student/aut250-lab-ui/integration-handoff.md`
- `tests/aut250-student-lab-ui/mock-adapter.test.js`
- `tests/aut250-student-lab-ui/student-lab-ui.test.js`
- `tests/aut250-student-lab-ui/ownership-boundary.test.js`

No engine, assessment, contract, Supabase, worker, script, workflow,
docs/governance, dashboard, curriculum, or config files were modified.

## 2. UI architecture

Static workstation page:

- `index.html`: semantic sections, skip link, live regions, canvas plus text caption.
- `aut250-lab.css`: responsive two-column grid collapsing to one column.
- `aut250-lab.js`: boots adapter, binds buttons, renders readouts, handles errors safely.
- `aut250-mock-adapter.js`: replaceable browser-safe local training simulation.

No network calls, storage, identifiers, grading, or research collection.

## 3. Adapter API contract

Mock exposes:

- `session()` — no-arg local simulated session using Web Crypto with injectable test ID.
- `record(type, payload)` — local event; supports `session-ended`; closed sessions throw.
- `test(testId)` — deterministic simulated measurement; unknown/closed throws.
- `repair(repairId)` — known repairs return success/false; unknown/closed throws.
- `exportEvidence()` — local simulated bundle with `notForAssessment:true`.

## 4. Mock-to-R1 mapping

Full table: `adapter-compatibility.md`.

Summary:

- Session, record, test, repair, verification, evidence, lifecycle, IDs, and errors all require translation.
- Faults differ: mock cylinder-3 secondary open vs R1 cylinder-2 intermittent primary open.
- Assessment posture is compatible: both explicitly non-assessment prototypes.

## 5. Technical differences requiring resolution

- Select one SME-reviewed scenario; do not blend cylinder-2 and cylinder-3 faults.
- Define UI-to-engine test/instrument translation.
- Define repair/verification sequence and session lifecycle.
- Define pseudonymous identity handling under governance review.
- Do not change expected readings without SME approval.

## 6. Accessibility and security findings

Accessibility verified:

- Keyboard-focusable native buttons and fields.
- Skip link, semantic headings/labels, visible focus.
- Polite live status and readout regions.
- Scope text alternative; canvas explicitly supplementary.
- Responsive layout.

Security/privacy verified:

- No fetch/XHR/WebSocket/storage/API/gradebook/require behavior in runtime files.
- Random local session ID only.
- Explicit simulated/not-for-assessment labels.
- Closed sessions refuse further mutation.

## 7. Tests executed and results

Local isolated validation to report after the final test run.

## 8. Remaining blockers

1. Confirm final PR #1050 CI completion.
2. SME must resolve cylinder-2 vs cylinder-3 scenario mismatch.
3. Dedicated integration PR must implement translation, lifecycle, identity, and review records.
4. No production deployment, migration, scoring, or research collection authorized.

## 9. Recommended integration sequence

1. Finish independent approval of PR #1050.
2. Obtain SME scenario sign-off.
3. Create a separate integration branch/PR.
4. Replace only the mock adapter module with a translation layer.
5. Preserve UI accessibility and error behavior.
6. Add integration tests across mock contract and real engine.
7. Conduct instructor, accessibility, privacy, and security review.
8. Hold university-pilot use until governance approval.
