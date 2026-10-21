# AUT 250 weekly virtual laboratories — ownership and architecture assessment

**Status:** planning artifact for review. No lab content, grading, publication, or
production change is authorized by this document.

**Authority:** GitHub Issue #1068 (lab delivery). **Source of truth:** PR #1067
`data/curriculum/aut250-weekly-lab-blueprint.json` and
`docs/institutional-readiness/AUT250-CLINE-WEEKLY-LABS-TASK.md`. Companion
question-bank work: Issue #1066.

**Course:** `aut-250` — Automotive Diagnostics I (3 credits, 15 weeks).
**Competency:** `ug-aut250-systematic-diagnostics` (unchanged).

---

## 1. Verified dependency state (checked, not assumed)

| Item | State at assessment time | Consequence |
| --- | --- | --- |
| PR #1067 blueprint + Cline task doc | **OPEN, unmerged** (`feat/aut250-weekly-lab-blueprint`) | Blueprint is **not** on `main`. Cannot be a build-time dependency yet. |
| PR #1063 OBD reference catalog schema | **OPEN, unmerged**, merge state BLOCKED | OBD-I/OBD-II code authority unavailable; Week 3–4 code meaning must stay `source_review_pending`. |
| PR #1064 question/scenario blueprint framework | **OPEN, unmerged**, mergeStateStatus BEHIND | Scenario blueprint reuse is prospective only. |
| PR #1065 instructor authoring workspace | **OPEN, unmerged** | No instructor authoring UI dependency assumed. |
| Issue #1066 question bank | **OPEN, no PR yet** | Weekly lab ↔ question linkage is planned, not implemented. |
| PR #1055 lab assets (`dashboard/student/aut250-lab-assets/**`) | **MERGED to `main`** | Available for reuse. |
| PR #1050 student lab UI (`dashboard/student/aut250-lab-ui/**`) | **MERGED to `main`** | Available for reuse. |
| `engine/aut250MisfireLab.js` (R1, cyl-2 primary open) | **on `main`** | Read-only reuse; browser-unsafe (CommonJS + `node:crypto`). |
| `engine/circuitLabCalculations.js` | **on `main`** | Read-only; ideal DC steady-state only. |
| `contracts/aut250-engine-integration/**`, `contracts/diagnostic-evidence/**` | **on `main`** | Read-only contracts for evidence shape. |

**Design consequence:** the validator treats the blueprint as an *optional
external input*. When present it enforces conformance; when absent it reports an
explicit missing-source blocker instead of silently passing. No blueprint data is
copied or re-authored into this package.

---

## 2. Ownership map

### 2.1 New paths owned by this workstream

| Path | Contents | Served to students? |
| --- | --- | --- |
| `dashboard/student/aut250-weekly-labs/**` | Student runtime, per-lab student bundles, JSON schemas, README | Yes (when routes are registered, PR B+) |
| `instructor-resources/aut250-weekly-labs/**` | Per-lab instructor reference and feedback guides | **No — never under `dashboard/`** |
| `tests/aut250-weekly-labs/**` | Acceptance tests and fixtures | No |
| `docs/institutional-readiness/aut250-weekly-labs/**` | This assessment, validation plan, per-lab review logs | No |
| `scripts/verify-aut250-weekly-labs.js` | **New** deterministic validator (no existing script modified) | No |

### 2.2 Read-only inputs (inspect, never modify)

- `data/curriculum/aut250-weekly-lab-blueprint.json` — PR #1067
- `docs/institutional-readiness/AUT250-CLINE-WEEKLY-LABS-TASK.md` — PR #1067
- `tests/aut250-weekly-labs.spec.js` — PR #1067 (distinct from `tests/aut250-weekly-labs/`)
- `data/curriculum/competencies.json`, `lesson-plans.json`, `content-policy.json`, `aut250-outcome-alignment-matrix.json`
- `engine/**`, `contracts/**`, `schemas/**`
- `dashboard/student/aut250-lab-assets/**`, `dashboard/student/aut250-lab-ui/**`
- `dashboard/student/circuit-lab-calculator/**`

### 2.3 Shared files requiring explicit coordination before any edit

| File | Why it is needed | Handling |
| --- | --- | --- |
| `scripts/build-static-site.js` | `STATIC_FILES` allowlist must list new lab pages for the built site | **Not touched in PR A.** Requested in PR B with approval. |
| `data/curriculum/*` registry-style files | Curriculum registries may be enumerating | No writes planned; lab packages live under the weekly-labs tree. |
| `supabase/**`, `.github/**`, `worker/**` | Production surface | Never touched. |

### 2.4 Why instructor material is not under `dashboard/`

The student bundle is publicly readable once routed. Instructor answer keys,
expected evidence, and misconception feedback therefore live in a separate
top-level tree (`instructor-resources/`) that is never routed, and a test asserts
that no student-side file contains instructor-only fields.

---

## 3. Laboratory package architecture

Two artifacts per week, validated separately:

1. **Student lab bundle** — `dashboard/student/aut250-weekly-labs/labs/aut250-lab-NN/lab.json`
   plus `index.html`. Contains scenario, supplied measurements with provenance,
   hypotheses prompts, test-selection options, worksheet prompts, repair
   verification plan, accessibility notes, source references (metadata only).
   Contains **no** expected answers, no keys, no instructor feedback.
2. **Instructor reference** — `instructor-resources/aut250-weekly-labs/aut250-lab-NN/reference.json`.
   Expected evidence, acceptable alternatives, misconception feedback, debrief
   prompts, and the technical review checklist state.

Both are validated against JSON Schemas in
`dashboard/student/aut250-weekly-labs/schema/`.

### 3.1 Fail-closed flags

Every lab package must declare, and must keep false:
`assessmentEligible`, `autoGradingEnabled`, `published`, `smeApproved`,
`rightsApproved`. A `true` value fails validation rather than being tolerated.

### 3.2 Measurement provenance

Each supplied reading carries `provenance` from a closed set
(`supplied_simulation`, `illustrative`, `sme_review_pending`) plus conditions and
an instrument reference. Waveform evidence is either `qualitative` descriptors or
`illustrative_samples` with `illustrative: true`; a `manufacturerVerified` claim
is rejected outright, because the project holds no verified waveform provenance.

---

## 4. Asset reuse plan (verified against `main`)

| Need | Reusable asset on `main` | Availability | Gap / action |
| --- | --- | --- | --- |
| Multimeter (V, Ω, continuity, units) | `dashboard/student/aut250-lab-assets/src/multimeter.js` | **Available** — data-driven, accepts supplied measurements | Reuse via its `setMeasurement` contract. No modification. |
| Oscilloscope (scales, trigger, channels, text alternative) | `dashboard/student/aut250-lab-assets/src/oscilloscope.js` | **Available** — renders only supplied samples | Reuse via `setChannels`/`setTrigger`. Qualitative descriptors must be authored as text, not as invented traces. |
| Scan tool (DTCs, freeze frame, live data, misfire, verification) | `dashboard/student/aut250-lab-assets/src/scan-tool.js` | **Available** | Reuse via `setData`. |
| Battery, coil, plug, harness, connector, cylinders, grounds, power/signal circuits | `dashboard/student/aut250-lab-assets/src/vehicle-components.js` | **Available** — 9 categories, SVG training geometry | Reuse. Lightweight 3D is **not** available; do not claim 3D interactions. |
| Student diagnostic workstation shell | `dashboard/student/aut250-lab-ui/**` | **Available** but bound to the cylinder-3 **mock** scenario | Reuse only as an interaction pattern. Must not be presented as the R1 cylinder-2 engine scenario. |
| Ignition misfire engine (R1, cylinder-2 primary open) | `engine/aut250MisfireLab.js` | **Available** but CommonJS + `node:crypto` | Not browser-callable. Week 10 uses qualitative evidence and explicitly labeled supplied values until a reviewed integration exists. |
| Ideal DC calculations | `engine/circuitLabCalculations.js`, `dashboard/student/circuit-lab-calculator/**` | **Available** | Weeks 5–6 only. It models **steady-state resistive** circuits, not ignition-coil transients. |
| OBD-I/OBD-II code authority | PR #1063 (unmerged) | **Not available** | Weeks 3–4 code meaning stays `source_review_pending`; no reproduced code tables. |
| Vehicle 3D/animation assets | `dashboard/student/*-lab/**`, `animation/**` | Partially available for other systems | **Gap:** no AUT-250-specific 3D vehicle model. Disclose as missing; do not fake. |

**Rule:** the reuse plan is tested against the filesystem. A lab may not claim an
asset that does not exist on disk.

---

## 5. Route plan

- Lab pages are static HTML at
  `dashboard/student/aut250-weekly-labs/labs/aut250-lab-NN/index.html`.
- The built site is driven by an explicit allowlist in `scripts/build-static-site.js`.
  Adding pages therefore requires editing that shared file.
- **PR A does not modify it.** PR B requests approval to register the lab pages,
  or delivers the labs reachable only in local/dev serving with that limitation
  documented and tested.
- No API route, Worker route, Supabase route, or exam route is added at any stage.
- A route smoke test is required per delivery PR once pages exist; PR A ships the
  test scaffolding and the assertion that no lab page is publicly routed while
  `published` is false.

---

## 6. Technical accuracy constraints (binding)

1. **OBD-I** code meaning requires make, year, engine and retrieval/test mode.
   Week 3 must require that context before interpretation is accepted.
2. **OBD-II** generic versus manufacturer-specific codes must be distinguished;
   a stored DTC is evidence of a monitored condition, **not proof** a component failed.
3. **Week 10** must not conflate the R1 engine's cylinder-2 internal primary
   winding open with the independent cylinder-3 illustrative UI mock.
4. **Qualitative scope evidence ≠ sampled waveform data.** No fictional
   manufacturer-verified traces and no invented numeric specifications.
5. The ideal 12 V / 6 Ω calculator models steady-state resistive circuits and
   **not** transient ignition-coil behavior.
6. Every reading is labeled with units, operating conditions and provenance;
   uncertainty and next-test justification are required student outputs.

---

## 7. Accessibility plan

- Keyboard reachable controls, visible focus, semantic headings and labels.
- Live status regions for every data-supply and rejection event.
- Text alternatives for every visual instrument output; the scope canvas is
  supplementary and its description is authoritative.
- `prefers-reduced-motion` honored; no meaning depends on animation.
- Responsive layout verified at narrow widths.
- Manual browser and assistive-technology review evidence is required per
  delivery PR. Automated structural checks are **not** claimed as accessibility
  conformance.

---

## 8. Intellectual property and source rights

- Uploaded OBD references have **unverified reproduction rights**. Only source
  metadata and page pointers may be cited, and only where demonstrably available.
- No proprietary code tables, OEM procedures, or bulk text reproduction.
- Every reference record carries `citationStatus` and `rightsStatus`; both must
  stay non-approved until reviewed. The validator fails a lab that cites an
  unapproved source as authority for a numeric limit.
- `rightsApproved` and `smeApproved` remain `false` in all packages.

---

## 9. Assessment eligibility posture

All 15 labs and the Week 15 capstone remain `assessmentEligible: false`,
`autoGradingEnabled: false`, `published: false`. Week 15 is instructor-reviewed
and separate from the proposed 50-question written final
(`examDeliveryEnabled: false`, `automaticScoringEnabled: false`). No exam unlock,
grade write, progress mutation, or eligibility change is performed.


---

## 10. PR breakdown

| PR | Scope | Gate |
| --- | --- | --- |
| **A (this PR)** | Ownership map, schemas, validation plan, validator, acceptance tests | Validator and tests pass; no lab content |
| B | Labs 1–4 (+ route registration request) | Schema-valid packages; route + a11y evidence |
| C | Labs 5–8 | Same, plus DC-calculator scope guard |
| D | Labs 9–12 | Same, plus scope evidence provenance guard |
| E | Labs 13–15 + Week 15 capstone | Instructor-reviewed capstone artifacts |
| F | Integration verification and cumulative review report | Manual keyboard/browser/a11y evidence |

Each PR is independent, isolated from `main`, and stops for review. No PR merges
or deploys without explicit authorization.

---

## 11. Blockers

1. **Blueprint not on `main`.** PR #1067 is open/unmerged, so the authoritative
   lab IDs, titles, equipment lists and objectives cannot be a build dependency.
   PR A proceeds with an optional-input design; PR B should start only after
   #1067 is merged or its blueprint is otherwise frozen and available.
2. **OBD code authority unavailable.** PR #1063 unmerged; Weeks 3–4 cannot carry
   verified code meanings. Planned resolution: `source_review_pending` markers and
   no reproduced code tables.
3. **No AUT-250-specific 3D vehicle model.** Disclose as a missing asset rather
   than substituting unrelated geometry presented as a vehicle.
4. **Engine not browser-callable.** `engine/aut250MisfireLab.js` uses CommonJS and
   `node:crypto`; a reviewed browser-safe adapter is out of scope here.
5. **`scripts/build-static-site.js` registration requires coordination.** Without
   it, lab pages are not part of the built site.
6. **Instructor-side hosting undecided.** `instructor-resources/` is proposed as a
   non-routed tree; institutional sign-off on where instructor keys are stored is
   required before PR E.
7. **Contact-hour approval pending.** 15 × 120 min (30 lab hours) is a proposal
   subject to institutional contact-hour review.
8. **SME and rights review outstanding** for every planned reading, source, and
   fault model.

