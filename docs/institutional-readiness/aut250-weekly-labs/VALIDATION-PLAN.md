# AUT 250 weekly laboratories — validation plan

**Companion to:** `OWNERSHIP-AND-ARCHITECTURE.md` (same directory).
**Validator:** `scripts/verify-aut250-weekly-labs.js`.
**Tests:** `tests/aut250-weekly-labs/`.

## 1. Principles

1. **Fail closed.** An unavailable dependency, an unreadable artifact, a missing
   source, or an unknown state is an error. Nothing is assumed valid by default.
2. **Never fabricate.** The validator does not synthesize lab content, readings,
   codes, specifications, or approvals. It only inspects what exists.
3. **Deterministic.** Two runs over the same tree produce byte-identical reports;
   the report contains no timestamps.
4. **Read only.** The validator performs no filesystem writes.
5. **Passing validation is not approval.** Structural validity never confers
   technical, curricular, licensing, or institutional signoff.

## 2. What is validated

### 2.1 Structural (JSON Schema, draft-07)

Student bundle — `dashboard/student/aut250-weekly-labs/schema/student-lab.schema.json`:

- Required sections, closed objects (`additionalProperties: false`).
- `durationMinutes` exactly 120; `delivery` and `competencyId` pinned to the
  approved values.
- `sessionMinutes` keys present.
- At least two competing hypotheses and two test-selection options.
- Measurement provenance restricted to a closed set.
- Waveform evidence mode restricted to `qualitative` or `illustrative_samples`.
- Source records require both `citationStatus` and `rightsStatus`.
- All five approval/publication flags are `const false`.

Instructor reference — `.../schema/instructor-reference.schema.json`:

- `instructorOnly` must be `true`.
- Expected evidence, acceptable alternatives, misconception feedback, and debrief
  prompts present.
- Same fail-closed flags.

### 2.2 Semantic (validator, beyond schema reach)

| Rule | Failure code |
| --- | --- |
| Session minutes total exactly 120 | `session-minutes` |
| `durationMinutes` is 120 | `duration` |
| `labId` suffix matches `week` | `lab-id-week` |
| A declared `assetRef` exists on disk | `asset-missing` |
| Sampled waveforms are marked illustrative | `waveform-not-marked-illustrative` |
| No manufacturer-verified waveform claim | `waveform-manufacturer-claim` |
| Every flag is `false` | `flag-not-false` |
| No instructor-only field in a student bundle | `student-answer-leak` |
| No duplicate lab ids | `duplicate-lab-id` |
| Each lab has an instructor counterpart and vice versa | `instructor-missing`, `lab-missing-for-instructor` |
| Instructor references never inside the student tree | `instructor-under-student-tree` |
| Declared lab ids exist in the approved blueprint | `blueprint-unknown-lab` |
| Week and title match the approved blueprint | `blueprint-week`, `blueprint-title` |

### 2.3 Reported but non-blocking (review queue)

These never auto-approve; they populate a human review queue:

- `measurement-provenance` — a reading marked `sme_review_pending`.
- `source-citation` — `citationStatus` is not `verified`.
- `source-rights` — `rightsStatus` is `pending`.
- `equipment-availability` — an instrument is `prototype` or `missing`.

Warnings (non-blocking, still reported):

- `undisclosed-gap` — unavailable equipment with no explanatory note.
- `missing-unit` / `missing-conditions` — a reading lacking units or conditions.

### 2.4 Corpus completeness

- Exactly 15 labs, ids `aut250-lab-01` … `aut250-lab-15`.
- Delivered minutes must reach 1800 when complete.
- Undelivered labs are listed by id. A partially delivered course reports
  `incomplete` and exits non-zero; it can never present as `pass`.

### 2.5 Missing-source detection

`data/curriculum/aut250-weekly-lab-blueprint.json` is an **optional external
input** while PR #1067 is unmerged. When absent the report sets
`blueprint.available = false` and records the blocker text. Blueprint
conformance checks are then skipped **and the gap is reported** — the run does
not silently pass as though conformance had been verified.

## 3. Commands

```powershell
node scripts/verify-aut250-weekly-labs.js          # human summary
node scripts/verify-aut250-weekly-labs.js --json   # machine-readable report
npx jest tests/aut250-weekly-labs --runInBand      # acceptance tests
```

Exit code is `0` only for `pass`. `incomplete` and `fail` both exit non-zero.

## 4. Acceptance gates per delivery PR

| Gate | Applies to |
| --- | --- |
| Validator reports `pass` for delivered labs, with no errors | B–F |
| Instructor reference exists for every delivered lab | B–E |
| Route smoke test for each new page | B–F |
| Manual keyboard traversal evidence recorded | B–F |
| Browser and assistive-technology review evidence recorded | B–F |
| Accessibility findings recorded, including unresolved items | B–F |
| Source rights and citation status recorded per reference | B–E |
| SME review checklist completed by a human, not by CI | B–F |
| No flag changed from `false` | B–F |

## 5. What validation does not prove

- It does not verify automotive technical accuracy.
- It does not verify that a scenario is physically plausible.
- It does not verify accessibility conformance; structural checks are not
  assistive-technology testing.
- It does not clear source reproduction rights.
- It does not authorize publication, grading, or assessment eligibility.
- It does not prove a lab is instructionally sound.

Each of these requires a named human reviewer and is recorded outside this
validator.
