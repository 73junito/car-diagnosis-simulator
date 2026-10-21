# PR B report — AUT 250 Weeks 1–4 laboratory implementation

**Status:** draft / review-only. Developmental and formative. No grade, no
publication, no assessment eligibility, no deployment.

**Dependencies (as authorized):**
- PR #1067 frozen at `c652ff69c192f70b5967a20d3b52ebbf0ba6ed6d` — planning source of truth, read only, **not copied**.
- PR #1069 (PR A) — schemas, validator and ownership map. PR B is stacked on it.

**Stacked PR note:** this branch is based on `feat/aut250-weekly-labs-a-foundation`
so the review diff contains only Weeks 1–4. PR B must **not** merge until PR #1069
(and the needed schema/blueprint code) is merged and validated on updated `main`.

---

## 1. What was delivered

| Artifact | Count | Location |
| --- | --- | --- |
| Student lab packages | 4 | `dashboard/student/aut250-weekly-labs/labs/aut250-lab-0N/lab.json` |
| Student lab pages | 4 | `.../labs/aut250-lab-0N/index.html` |
| Instructor references | 4 | `instructor-resources/aut250-weekly-labs/aut250-lab-0N/reference.json` |
| Disclosed stand-in inputs | 3 | `work-order.json` (W2), `vehicle-profile.json`, `legacy-code-evidence.json` (W3) |
| Shared runtime | 1 | `.../src/lab-runtime.js` |
| Page boot | 1 | `.../src/lab-boot.js` |
| Stylesheet | 1 | `.../lab-weekly.css` |
| Tests | 2 suites added (5 total in the folder) | `tests/aut250-weekly-labs/` |
| Report | 1 | this file |

Each lab keeps the approved 10 / 15 / 60 / 25 / 10 minute flow totalling 120
minutes, mapped to the frozen blueprint's ids, weeks, titles, objectives and
equipment lists.

## 2. Equipment mapping — every blueprint id for Weeks 1–4

| Week | Blueprint id | Status | Resolution |
| --- | --- | --- | --- |
| 1 | `dvom` | **available** | Reused `aut250-lab-assets/src/multimeter.js` |
| 1 | `scan_tool` | **available** | Reused `aut250-lab-assets/src/scan-tool.js` (shows its explicit empty state, which is the teaching point) |
| 1 | `oscilloscope` | **available** | Reused `aut250-lab-assets/src/oscilloscope.js` (qualitative only; no trace plotted) |
| 2 | `work_order` | **prototype** | Minimal original stand-in, disclosed as not a completed tool |
| 2 | `service_information` | **missing** | Disclosed. No approved source exists and uploaded references have unverified rights. The lab requires students to state the need instead |
| 3 | `legacy_code_reference` | **prototype** | Minimal original stand-in with an illustrative observation and retrieval procedure. Contains **no** code table, glossary or OEM definition |
| 3 | `vehicle_profile` | **prototype** | Minimal original stand-in supplying the make/year/engine/test-mode context OBD-I requires, using illustrative training labels only |
| 4 | `scan_tool` | **available** | Reused `scan-tool.js`, fed a placeholder payload |
| 4 | `freeze_frame` | **available (reuse mapping)** | Rendered by the same scan-tool asset from the supplied payload. There is no separate freeze-frame asset; the lab says so |

The validator enforces this: a declared `assetRef` that does not exist on disk
fails with `asset-missing`, and every lab declares an availability status with a
disclosure note.

## 3. Validator result (honest partial progress)

```
status: incomplete
labs: 4/15 · instructor references: 4 · minutes: 480/1800
blueprint: MISSING — Blueprint unavailable (PR #1067 unmerged)
not yet delivered: aut250-lab-05 … aut250-lab-15
errors: []
```

- **No errors** are reported for the four delivered labs.
- The program is **not** reported as passing: 11 labs remain undelivered.
- The blueprint gap is reported as a blocker rather than assumed satisfied.
- `source-citation` and `source-rights` review items are surfaced for human review.

## 4. Verification performed

| Check | Result |
| --- | --- |
| `npx jest tests/aut250-weekly-labs` | **5 suites / 69 tests passed** |
| Schema validation of 4 student + 4 instructor artifacts | passed |
| Semantic validation (minutes, ids, assets, flags, leakage) | passed, no errors |
| `node --check` on all new JS | passed |
| Scoped ESLint | clean |
| `git diff --check` | clean |

### Defect found during this work — fixed in PR #1069

The PR A validator recompiled its JSON Schema **per lab package**. Ajv rejects
a second schema with the same `$id`, and `validateWithSchema` re-read the schema
file on every call, so validating a second lab threw
`schema with key or id ... already exists`. The defect was latent in PR A because
PR A ships zero labs; it blocked every later delivery PR.

**Fixed in PR #1069** (commit `79cd0d0b`) with a per-run compiled-schema cache,
plus six regression tests that reproduce the original failure faithfully.
This branch is rebased onto that commit, so the validator is byte-identical to
PR A and this PR carries no validator change. PR B must not merge before
PR #1069.

---

## 5. Browser and keyboard test report

This report separates what was actually verified from what was not. No claim of
accessibility conformance is made.

### 5.1 Verified in this environment (automated, jsdom)

- The runtime renders every required section for all four labs.
- All interactive controls are native `button`, `select`, `textarea` elements.
- Every test-selection control is a `button` and is programmatically focusable.
- Every `textarea` and `select` has a matching `label[for]`.
- The lab status region carries `role="status"` and `aria-live="polite"` and is
  updated on selection, clearing and summary actions.
- Qualitative waveform evidence renders as text; the oscilloscope reports
  "No waveform data supplied" and no trace is plotted.
- Week 2 shows the explicit missing-equipment disclosure and mounts no instrument.
- Week 4 renders placeholder identifiers only; no `[PBCU]dddd` code appears.
- No rendered output contains instructor-only content.
- The local summary contains no score, grade, points or percentage value.

### 5.2 NOT verified — requires a human on a real browser

These were **not** tested and must not be claimed as passing:

1. Real browser rendering in Chromium, Firefox and Safari.
2. Screen-reader behaviour with NVDA, JAWS or VoiceOver.
3. `prefers-reduced-motion` behaviour in a real browser (the CSS is present but
   unverified against actual motion).
4. Windows high-contrast / forced-colors mode.
5. Zoom to 200 % and 400 % reflow.
6. Narrow-viewport layout at 320 px, and table overflow behaviour.
7. Keyboard-only traversal of the full page in a real browser, including focus
   order across the reused asset controls.
8. Playwright could not be run: the isolated worktree has no installed
   dependencies and no browser binaries.

### 5.3 Manual test script for the reviewer

Serve the repository root over HTTP from this branch, then open
`/dashboard/student/aut250-weekly-labs/labs/aut250-lab-01/index.html` and repeat
for weeks 2–4.

1. Press `Tab` immediately after load: the skip link must receive focus first.
2. Traverse the whole page with `Tab` only; every control must be reachable and
   the focus indicator must be visible.
3. Activate each test-selection control with `Enter` and `Space`; the pressed
   state must change and the status region must announce the selection.
4. Confirm the oscilloscope shows no plotted trace and that the text states that
   no sampled trace is supplied.
5. On Week 2, confirm the service-information row states it is not available and
   that no instrument is mounted.
6. On Week 3, confirm no code meaning is presented anywhere.
7. On Week 4, confirm the placeholder identifiers are visible and that no real
   diagnostic trouble code is shown.
8. Build the local summary and confirm no score, grade or percentage appears.
9. Reload the page and confirm nothing was retained.
10. Enable the operating-system reduced-motion setting and confirm no animation
    is required to read any content.
11. Set zoom to 200 % and confirm no content is clipped or hidden.
12. Confirm the page states it is a developmental preview and not a deployed route.

### 5.4 Route status — not deployed

The pages are **not** registered in `scripts/build-static-site.js`, which was not
modified. They are reachable only when the repository is served locally. This is
a deliberate limitation, not a deployed route, and the pages say so.

---

## 6. Known gaps and blockers

1. **Blueprint not on `main`.** PR #1067 is unmerged, so blueprint conformance
   cannot be verified in CI. Lab ids, weeks, titles and equipment were matched by
   hand against the frozen commit `c652ff69`.
2. **PR #1069 dependency.** PR B is stacked on PR A and must not merge first.
   PR A now carries the validator fix (commit `79cd0d0b`) that multi-lab
   validation depends on; this branch is rebased onto it.
3. **Route registration not requested yet.** `scripts/build-static-site.js`
   remains unmodified pending a separate ownership agreement.
4. **OBD code authority unavailable.** PR #1063 unmerged, so Weeks 3–4 carry no
   code meanings. This is by design, not an omission.
5. **Stand-in inputs are limited.** The work-order, vehicle-profile and
   legacy-code stand-ins are deliberately minimal and contain no lookup or
   persistence capability. The stand-in JSON files are referenced and inspectable
   at their declared path but are not fetched into the page; the essential content
   is also carried in the lab package so the student sees it.
6. **No AUT-250-specific 3D vehicle.** No 3D interaction is claimed.
7. **Engine not used.** `engine/aut250MisfireLab.js` was not bundled, imported or
   called. Week 10 remains out of scope for this batch.
8. **SME, rights and instructor review outstanding** for every reading, source,
   fault model and checklist item. All checklist statuses are `pending`.

## 7. Restrictions observed

No merge, deployment, publication, grading, assessment-eligibility change,
Supabase or gradebook write, migration, exam unlock, or production route change.
All five approval flags are `false` in every artifact. The dirty primary
`F:\TorqueMind` checkout was not modified. PR #1067, #1063, #1064, #1065 and
#1069 owned files were not modified, except that this branch builds on PR #1069
as its declared base.

## 8. Next steps (not started, awaiting approval)

- PR C: labs 5–8, including the DC-calculator scope guard for steady-state
  resistive circuits only.
- Request approval for lab-page registration once PR #1069 is merged.
- Carry out the manual browser and assistive-technology review in 5.3.
- Obtain SME, rights and instructor review before any pilot use.

