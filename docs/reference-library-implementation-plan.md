# Reference Library — Implementation Plan & Data-Contract Review

**Status:** Design / architecture review. No code, schema, or generated files changed by this document.
**Scope:** In-app three-panel reference library UI built on the **existing** governed contracts.
**Branch policy:** Feature branch only; changes to the governed contracts require separate review.
**Grounding:** Every claim below is derived from the actual source files listed in §9, not from filenames or prior reports.

---

## 0. Executive summary

The reference library already has a **real, governed backend**: a read-only, service-role endpoint (`GET /api/curriculum/references`) over RLS-locked tables, plus an **existing student consumer** on the learning-path page. This plan does **not** propose new product behavior; it proposes a **dedicated, three-panel discovery surface** that consumes the same contract and surfaces the rights/applicability metadata it already returns.

Three findings bound the design:

1. **The dataset is small and fully governed.** Coverage is 12/64 lessons (18.8%) with ~10 active student sources. No pagination is needed today; client-side filtering is acceptable.
2. **Several panels in the concept are NOT backed by the current schema** — specifically *Search*, *Vehicle systems*, *Revision history*, and a *Verified* status. The concept itself says panels "should expose only information supported by the actual data contracts," so these are called out as gaps requiring explicit contract/schema decisions, not silently faked.
3. **Rights are the centerpiece and must be authoritative.** The 8-boolean `rights` object is the permitted-use signal. The migration and its tests make clear these references are **supplemental/bibliographic only** and grant **no** evidence approval, AI/RAG ingestion, direct reproduction, or assessment eligibility. The UI must render rights faithfully and never imply more than the booleans allow.

**Recommendation:** Stage as (1) this contract audit + plan, (2) UI on existing contract, (3) tests, (4) browser/a11y review, (5) deferred `theme.css` migration. Do **not** change the endpoint or schema in the first UI pass.

---

## 1. Data-contract audit (verified from source)

### 1.1 Endpoint — `worker/routes/curriculum-references.js`

`GET /api/curriculum/references` → `handleCurriculumReferences`. Verified behavior:

- **Method:** `GET` only; any other method → `405`.
- **Config:** builds a service-role Supabase client; missing `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` → `500`.
- **Query params:** exactly one — optional `lessonPlanId` (trims + filters mappings by `lesson_plan_id`). **No search, text query, source-type, vehicle, or pagination parameters exist.**
- **Visibility filter (server-enforced):** sources are returned only when `status = 'active'` **and** `audience = 'student'`. Sources not mapped to a lesson plan are **not** returned (mappings drive the ID set).
- **Fail-closed:** any mapping or source query error → `500` (`'Curriculum reference library unavailable'`). Empty result → `{ data: [], mappings: [] }` with `200`.
- **Deliberately withheld fields:** `local_filename` and `rights_basis` are **never** selected or returned (governance/internal fields stay server-side). The contract test asserts the route does not contain these strings.

**Response shape** (`{ data, mappings }`), camelCased from the DB:

```
data: [{
  id, title, publisher, publicationYear, subjectArea, sourceKind,
  canonicalUrl, licenseClassification,
  rights: {
    citationLinkAllowed, paraphraseSummaryAllowed, directReproductionAllowed,
    databaseStorageAllowed, aiRagIngestionAllowed, commercialUseAllowed,
    attributionRequired, shareAlikeRequired   // all booleans
  }
}]
mappings: [{ reference_id, lesson_plan_id, role, notes }]
```

**Authorization:** Like `/api/curriculum`, this endpoint is **unauthenticated** (no `Authorization` handling) and relies on server-side service-role reads with the visibility filter. CORS is restricted (see §1.4). This is intentionally different from the authenticated `/api/research/*` routes.

### 1.2 Schema — `supabase/migrations/20260930005918_add_curriculum_reference_library.sql`

`curriculum_reference_sources` columns (authoritative):

| Column | Type / constraint | Exposed to UI? |
| --- | --- | --- |
| `id` | text PK | ✅ |
| `title` | text not null | ✅ |
| `publisher` | text | ✅ |
| `publication_year` | integer | ✅ |
| `subject_area` | text not null | ✅ (academic subject, **not** vehicle system) |
| `source_kind` | enum: `oer-textbook` \| `technical-reference` \| `publisher-guidance` | ✅ |
| `canonical_url` | text | ✅ |
| `local_filename` | text | ❌ withheld |
| `license_classification` | text not null | ✅ |
| 8 × rights booleans | `..._allowed`, `attribution_required` (default true), `share_alike_required` | ✅ (as `rights`) |
| `audience` | enum `student` \| `instructor` \| `internal` (default `student`) | ❌ (filter only; `internal` never reaches students) |
| `status` | enum `active` \| `restricted` \| `retired` (default `active`) | ❌ (filter only; only `active` returned) |
| `rights_basis` | text not null | ❌ withheld |
| `created_at`, `updated_at` | timestamptz | ❌ not selected |

`curriculum_reference_mappings`: `reference_id` (FK→sources, cascade), `lesson_plan_id` (FK→`curriculum_lesson_plans`, cascade), `role` text, `notes` text, `created_at`. PK `(reference_id, lesson_plan_id, role)`.

**Security:** RLS enabled on both tables; `revoke all ... from public, anon, authenticated`; grants only to `service_role`. Indexes on `mappings(lesson_plan_id)` and `sources(subject_area)`.

**Notably absent from the schema** (drives the "gap" flags in §2): there is **no** vehicle/system column, **no** revision/version-history table, **no** applicability/conditions field, and **no** verification/attestation state distinct from `status`.

### 1.3 Existing consumer (the regression baseline) — `dashboard/student/learning-path/index.html`

This page already fetches `/api/curriculum/references` (in parallel with `/api/curriculum`) and renders a simple card list:

- Groups by source; shows `title`, a `publisher · year · subjectArea` meta line, a **rights label**, "Mapped learning topics" (resolving `lesson_plan_id` → lesson title from `/api/curriculum`), mapping `notes`, and an "Open reference" external link (`target=_blank`, `rel="noopener noreferrer"`).
- **Rights label logic (must be preserved):** if `aiRagIngestionAllowed && commercialUseAllowed && directReproductionAllowed` → *"Reusable with attribution under the recorded license."*; otherwise → *"Reference only: citation/linking permitted; platform AI ingestion, direct reproduction, and commercial reuse are disabled."*
- Status region is `role="status" aria-live="polite"`; empty state text: *"No supplemental references are mapped yet."*

`tests/student-learning-reference-ui-contract.test.js` locks these strings and asserts the page does **not** contain `rights_basis`, `local_filename`, or `sae-reuse-guidance-2026` (the `internal`-audience source). **Any new UI must not break this test or duplicate governance strings.**

### 1.4 Authorization / CORS posture — `worker/index.js`

- `/api/curriculum/*` CORS allows origins `https://app.autolearnpro.com` **and** `https://exam.autolearnpro.com`, `GET, OPTIONS`, header `Content-Type` only.
- `/api/research/*` (Semantic Scholar, evidence) is a **separate, authenticated, role-restricted** family. The reference library must remain in the **read-only, unauthenticated curriculum family** — it must not pull in research/auth behavior.

### 1.5 Governance invariants that must not change

From the migration comments and batch tests (`*_contract.test.js`):

- References are **supplemental/bibliographic only**; they do **not** grant evidence approval, AI/RAG rights, direct-reproduction rights, or assessment eligibility.
- Specific sources are **noncommercial / no-AI-RAG** (e.g. OpenStax `CC_BY_NC_SA_4_0`, Fiore) and must keep citation/link-only treatment. Batch tests forbid migrations from touching `ai_rag_ingestion_allowed`, `commercial_use_allowed`, `direct_reproduction_allowed`, `database_storage_allowed`, `license_classification`, or any assessment-eligibility token.
- `sae-reuse-guidance-2026` is `audience='internal'` and must never surface to students.

---

## 2. Three-panel interface — defined against the real contract

Each concept panel is mapped to actual data. Panels that the schema does **not** support are marked **GAP** with the decision required. Nothing is fabricated; every visible field traces to §1.

### 2.1 Left panel — Discover / filter

| Concept control | Contract support | Decision |
| --- | --- | --- |
| **Search** (text box) | **GAP** — endpoint has no text query. With ~10 sources, implement **client-side** filtering over the already-fetched `data` (title/publisher/subject). No schema change. | Build client-side now; add a server `q` param only if the catalog grows. |
| **Source types** | ✅ `source_kind` enum (`oer-textbook`, `technical-reference`, `publisher-guidance`). | Client-side checkbox filter over distinct `source_kind` values. |
| **Vehicle systems** | **GAP** — no vehicle/system column. `subject_area` is an *academic* subject (e.g. "technical communication", "data science"), not a vehicle system. | **Do not** label `subject_area` as "vehicle system." Offer an "Academic subject" filter instead, derived from distinct `subject_area`. A true vehicle-system facet requires a schema decision (deferred). |
| Lesson scoping | ✅ optional `lessonPlanId` query + `mappings[].lesson_plan_id`. | When entered from a lesson, pre-filter to that lesson's mapped references and show the lesson context. |

### 2.2 Center panel — Results

- A list/grid of reference cards using the **existing** card pattern (reuse `.tm-card`, mirror the learning-path rendering so visual language is consistent).
- Each card shows only contract-backed fields: `title`, `publisher · publicationYear · subjectArea`, `source_kind`, `license_classification`, and the **rights label** (reuse the exact §1.3 logic/strings).
- Selecting a card updates the **right panel** (details) — a single-select pattern (radio semantics / `aria-selected`) for keyboard support.
- States: **loading** ("Loading references…"), **empty** (two distinct empties: "no results match your filters" vs. the contract's "No supplemental references are mapped yet."), **error** (surface the endpoint's failure as a non-alarming message with a retry, never a blank screen).

### 2.3 Right panel — Details / source information

| Concept field | Contract support | Rendering rule |
| --- | --- | --- |
| Source information | ✅ title, publisher, publicationYear, subjectArea, sourceKind, canonicalUrl, licenseClassification | Direct display. External link uses `target=_blank rel="noopener noreferrer"` and clear "opens in a new tab" affordance. |
| **Permissions** | ✅ the 8-boolean `rights` object | **Authoritative, explicit list.** Never infer; show each right as an explicit Allowed / Not allowed with a text label (not color alone). Preserve the summary rights label too. |
| Applicability | ⚠️ partial — mapping `notes` + `role` describe *how/why* a reference supports a lesson, not vehicle applicability | Show "Mapped learning topics" (lesson titles via `/api/curriculum`) + role + notes. **Do not** invent vehicle applicability. |
| **Revision history** | **GAP** — no history table; `updated_at`/`created_at` are not even selected by the endpoint | **Omit** in v1. Surfacing a fabricated history would violate the evidence-first principle. Requires a schema decision (deferred). |
| **Verified status** | **GAP** — `status` is `active|restricted|retired` (a visibility state), **not** a verification/attestation | **Do not** show a "Verified" badge from `status='active'`. That would misrepresent governance. A verified/attestation state is a separate schema decision (deferred). |

### 2.4 Responsive behavior

- **Desktop (≥1024px):** three columns (filter / results / details), details sticky.
- **Tablet:** collapsible filter (disclosure), results + details stacked; selecting a result reveals details below or in a slide-over.
- **Mobile:** single column — filter (collapsed) + results; selecting a result **navigates to a dedicated detail view** (or opens a full-height drawer) rather than a competing third column. Retain the learner's filter/selection state when returning.

### 2.5 Where it lives

- New route under the student app: `dashboard/student/reference-library/index.html`, reachable from the student nav and from the learning-path "Supplemental … References" section (add a "Browse all references" link). It **reuses** `/api/curriculum` + `/api/curriculum/references` and the canonical `theme/tokens.css` + `theme/layout.css` + `theme/dashboard.css` + `student.css` stack (same as the learning-path page — no `theme.css`).

---

## 3. Acceptance criteria

### Search, filtering, empty, loading, error
- [ ] Client-side search filters by title/publisher/subject; combined with source-type and subject facets; result count announced via a polite live region.
- [ ] Distinct, non-blank states: loading; "no results match your filters"; "No supplemental references are mapped yet." (contract empty); and an error state with retry.
- [ ] Filters are reflected in the URL/state so back-navigation restores them (mobile detail round-trip).

### Attribution & applicability
- [ ] Every card and detail shows accurate `publisher`, `publicationYear`, `subjectArea`, `source_kind`, `license_classification`.
- [ ] Applicability is presented only as mapped-lesson context (`role` + `notes` + lesson title). No invented vehicle applicability.

### Authorization & permitted use
- [ ] The UI never displays `rights_basis`, `local_filename`, or any `audience='internal'` source (e.g. `sae-reuse-guidance-2026`).
- [ ] Permissions render the 8 `rights` booleans explicitly; the summary label matches the existing learning-path logic exactly.
- [ ] The endpoint/schema/RLS are unchanged; visibility remains server-enforced (`active` + `student`).

### Missing / outdated / unverified handling
- [ ] No "Verified" badge is shown (no verification state exists). Absence of a badge is intentional, not an oversight.
- [ ] Missing optional fields (e.g. no `publisher`, no `canonicalUrl`) degrade gracefully (omit, don't render "undefined").
- [ ] Noncommercial / no-AI-RAG sources keep citation/link-only treatment via the rights label.

### Accessibility & responsive
- [ ] Keyboard: filter controls, result list (roving/radio semantics), and detail panel are fully operable; visible focus; logical tab order.
- [ ] Status never conveyed by color alone; rights use text labels.
- [ ] Focus moves to the detail panel on selection (desktop) and to the detail view heading on mobile.
- [ ] Layouts verified at desktop / tablet / mobile; details in a drawer or dedicated page on small screens.
- [ ] Target WCAG 2.2 AA (contrast for all states validated in-browser — see §5).

### Regression coverage
- [ ] `tests/student-learning-reference-ui-contract.test.js` still passes (learning-path strings preserved).
- [ ] `tests/curriculum-reference-library-contract.test.js` and batch `*_contract.test.js` still pass (contracts untouched).
- [ ] Diagnostic-learning workflows (scenario/learning-path data loads) unaffected.

---

## 4. Staging

1. **Contract audit + plan** — this document. ✅
2. **UI implementation** — build `dashboard/student/reference-library/` on the existing contract; reuse card/rights logic. No endpoint/schema change.
3. **Targeted tests** — add a `student-reference-library-ui-contract` test (mirrors the learning-path UI-contract style) + run the reference/curriculum contract suites; run lint.
4. **Browser review & a11y** — Playwright/keyboard pass + WCAG 2.2 AA contrast check across states.
5. **`theme.css` migration** — deferred, separate, only after a browser audit confirms the 5 consumers can migrate without regression.

---

## 5. Deferred decisions (require explicit product/schema sign-off)

These are intentionally **out of scope** for the first UI pass because they change governed contracts:

- **Vehicle/system facet** — needs a vehicle/system column or a controlled vocabulary mapped to `subject_area`.
- **Revision history** — needs a reference version/history table and endpoint exposure of `updated_at`.
- **Verified/attestation status** — needs a distinct governance state separate from `status`; must integrate with the existing evidence-approval model, not duplicate it.
- **Server-side search** — add a `q` parameter only if the catalog outgrows client-side filtering.

---

## 6. Risks

- **Overstating rights.** Mitigation: render booleans verbatim; keep the exact summary-label logic; never infer.
- **Mislabeling `subject_area`.** Mitigation: label it "Academic subject," never "Vehicle system."
- **Breaking the learning-path consumer.** Mitigation: reuse (not fork) its rendering; keep its contract test green.
- **Scope creep into governance.** Mitigation: endpoint/schema unchanged; deferred items tracked in §5.

---

## 7. Open questions for sign-off

1. Confirm **client-side** search/filtering is acceptable for the current catalog size (vs. adding a server `q` param now).
2. Confirm **omitting** Revision history and a Verified badge in v1 (rather than adding schema).
3. Confirm the route name/location `dashboard/student/reference-library/` and the "Academic subject" (not vehicle) facet label.

---

## 8. Out of scope of this plan

- No endpoint, schema, migration, or RLS change.
- No instructor/institutional/admin reference views (separate work).
- No changes to the Semantic Scholar research workflow.
- No `theme.css` de-linking (deferred per §4 step 5).

---

## 9. Source files reviewed (basis for this plan)

- `worker/routes/curriculum-references.js` — endpoint behavior, field selection, filters.
- `supabase/migrations/20260930005918_add_curriculum_reference_library.sql` — schema, RLS, seed sources/mappings.
- `supabase/migrations/20260930*_expand_reference_coverage_batch_*.sql` (+ `..._map_chemistry_additive_manufacturing_references.sql`) — mapping/coverage data.
- `worker/index.js` — route registration, CORS, auth posture.
- `worker/routes/curriculum-read.js` — sibling read contract (pattern reference).
- `dashboard/student/learning-path/index.html` — existing reference consumer (regression baseline).
- `tests/curriculum-reference-library-contract.test.js`, `tests/student-learning-reference-ui-contract.test.js`, `tests/curriculum-reference-coverage-batch-4-contract.test.js` — locked contracts.
- `docs/curriculum-reference-coverage-baseline.md` — current coverage (12/64 lessons).





