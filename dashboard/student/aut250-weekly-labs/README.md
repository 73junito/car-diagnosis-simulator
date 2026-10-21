# AUT 250 weekly laboratories (PR A — foundation)

Developmental, formative-only virtual laboratory foundation for
`AUT 250 — Automotive Diagnostics I`.

**Nothing here is graded, published, or assessment-eligible.** Every approval
and publication flag is `false` and the validator fails if any is set true.

## Status of this directory

PR A establishes the contract, not the lab experiences:

- `schema/student-lab.schema.json` — student bundle schema.
- `schema/instructor-reference.schema.json` — instructor reference schema.
- `labs/` — per-week student bundles (**empty until PR B**).

Per-lab instructor references live outside the student tree, at
`instructor-resources/aut250-weekly-labs/`, so they can never be served with the
student site.

## Planned layout

```
dashboard/student/aut250-weekly-labs/
  schema/student-lab.schema.json
  schema/instructor-reference.schema.json
  labs/aut250-lab-01/lab.json
  labs/aut250-lab-01/index.html      # added in PR B
  ...
instructor-resources/aut250-weekly-labs/
  aut250-lab-01/reference.json
  ...
```

## Authoritative planning input

`data/curriculum/aut250-weekly-lab-blueprint.json` (PR #1067) defines the 15
week ids, titles, equipment categories, objectives, and the 120-minute session
split. It is **not yet merged**, so the validator treats it as an optional
external input and reports its absence as a blocker rather than guessing.

## Session structure (per lab)

10 min safety brief and outcomes · 15 min demonstration · 60 min interactive
diagnosis · 25 min evidence and worksheet report · 10 min debrief.

## Rules a lab bundle must satisfy

1. `durationMinutes` is 120 and session minutes total 120.
2. At least two competing hypotheses and two test-selection options.
3. Every reading carries units, operating conditions, and provenance from a
   closed set; illustrative values are labelled as such.
4. Waveform evidence is qualitative descriptors or explicitly illustrative
   samples. Manufacturer-verified waveform claims are rejected.
5. Sources carry `citationStatus` and `rightsStatus`; neither is assumed approved.
6. No instructor answer, key, or feedback appears in the student bundle.
7. All five flags remain `false`.

## Validate

```powershell
node scripts/verify-aut250-weekly-labs.js --json
npx jest tests/aut250-weekly-labs --runInBand
```

See `docs/institutional-readiness/aut250-weekly-labs/VALIDATION-PLAN.md` for the
full rule set, and `OWNERSHIP-AND-ARCHITECTURE.md` for ownership, asset reuse,
routes, and blockers.

## Not included

No scoring, grading, assessment eligibility, publication, production database
access, migrations, deployment, or engine integration.
