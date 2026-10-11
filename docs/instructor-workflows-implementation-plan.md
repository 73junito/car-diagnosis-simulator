# Instructor Workflows — Implementation Plan & Capability Audit

**Status:** Design / architecture review. No code, schema, or generated files changed by this document.
**Scope:** Evidence-based audit of the existing instructor experience, then a staged plan.
**Branch policy:** Feature branch only. Any new functionality (classrooms, assignments, per-instructor analytics) requires new contracts, migrations, and server authorization — separated from UI refinement.
**Grounding:** Every capability claim below is derived from the actual source files listed in §10, not from filenames or endpoints' existence.

> **Guiding rule applied throughout:** a backend endpoint's existence does **not** imply a complete instructor interface, and a verification route does **not** imply classroom management. Each proposed workflow is mapped to verified capabilities first.

---

## 0. Executive summary

The instructor surface is **thinner than the concept envisions and partly mis-scoped**. What genuinely exists:

- A **verified-affiliation gate** (`instructor-verification.js`) that controls *access* to the instructor workspace — real, server-enforced, and well-tested.
- A small **instructor workspace** (`dashboard/instructor/`) with an entry gate, a **research discovery** tool (properly role-gated), a **live-session** monitor, a **session-history** page, and an **analytics** page.
- Server-side **role resolution** and an **evidence/research** workflow.

What does **not** exist (net-new functionality, not UI polish):

- **Classrooms / rosters / enrollment.** No model links an instructor to a set of students.
- **Case assignment** (assign a diagnostic case, set due dates, attempt limits). No assignment table or route.
- **Per-instructor scoping of analytics.** The `/api/analytics/*` endpoints are **unauthenticated and not scoped** — they aggregate over a local `analytics-report.json`, not "this instructor's students."
- **Assessment review / feedback** tooling for instructors (grading is student→server; there is no instructor review queue).

**Most important finding (a correctness/authorization gap, not just a gap in features):** the instructor analytics page renders data from endpoints that enforce **no authentication and no instructor scoping**, while the page *appears* gated behind verified affiliation. This creates a false sense that an instructor is seeing "their" students. Any instructor-reporting redesign must first make the data boundary real and instructor-scoped; until then, the UI must not imply ownership of that data.

**Recommendation:** Stage as (1) this audit + plan, (2) fix the analytics authorization/scoping boundary, (3) refine the existing workspace UI on verified contracts, (4) only then build net-new capabilities (classrooms, assignments, review) as their own contract+migration+UI efforts. Do **not** present current analytics as instructor-owned reporting.

---

## 1. Current routes and capabilities (verified from source)

### 1.1 Instructor UI surfaces (`dashboard/instructor/`)

| File | What it actually does | Gating |
| --- | --- | --- |
| `index.html` / `index.js` | Entry hub. Calls `/api/instructor/verification/status`; if `!authorizationGranted` → redirect to instructor sign-in; otherwise reveals two tool cards (Analytics, Research Discovery). | Client redirect + server `authorizationGranted`. |
| `research/index.html` / `research.js` | Scholarly research discovery + curriculum evidence-gap workflow (Semantic Scholar). | Server role gate (`RESEARCH_ROLES`) + `status === 'approved'`. |
| `live-session.html` / `live-session.js` | Real-time session event monitor (telemetry feed). | Loaded from the gated hub (no independent server check in-page). |
| `session-history.html` / `session-history.js` | Past session listing. | Loaded from the gated hub. |
| `analytics.html` / `analytics.js` | Summary cards + student table + ASE readiness. | **Page is behind the hub gate, but the data endpoints are NOT (see §2).** |

**No** classroom, roster, enrollment, assignment, or assessment-review page exists.

### 1.2 Server routes that back the instructor experience

| Route (worker) | File | Auth | Scope |
| --- | --- | --- | --- |
| `GET /api/instructor/verification/institution` | `instructor-verification.js` | Bearer token | Resolve institution by school code. |
| `POST /api/instructor/verification/request` | `instructor-verification.js` | Bearer token | Create a **pending** affiliation request (never grants a role). |
| `GET /api/instructor/verification/status` | `instructor-verification.js` | Bearer token | Returns `authorizationGranted` = admin OR (instructor role AND `status==='approved'` AND institutional email verified). |
| `GET /api/research/semantic-scholar/*` | `semantic-scholar-research.js` | Bearer + `RESEARCH_ROLES` + approved verification | Research discovery. |
| `GET /api/analytics/sessions` | `api/analytics/sessions.js` | **None** | Aggregates `analytics-report.json` (all sessions). |
| `GET /api/analytics/students` | `api/analytics/students.js` | **None** | Aggregates `analytics-report.json` (all students). |
| `GET /api/analytics/{cohort,heatmap,export}` | `api/analytics/*.js` | **None** (method guard only) | Aggregate/derived views. |
| `GET /api/student/progress` | `student-progress.js` | Bearer token | **Self** progress only (`user_id = caller`). Not an instructor view. |

Note: there are **two** analytics implementations — Cloudflare Worker routes under `worker/` and Express-style handlers under `api/`. The instructor page fetches `/api/analytics/*` (the `api/` family). The `api/analytics/*` handlers read a **local JSON file**, not the live database, and are unauthenticated.

---

## 2. Authentication and authorization boundaries (the critical section)

### 2.1 What is properly enforced
- **Affiliation gate (strong):** `instructor-verification.js` verifies a Supabase JWT, resolves a trusted role (`app_metadata.role` or `profiles.role`), and only grants `authorizationGranted` when `admin` OR (instructor role AND request `approved` AND institutional email domain verified). The migration enforces `pending ⇒ no role/access`, and the contract test asserts the route never writes a role. **This is a real, server-authoritative gate.**
- **Research route (strong):** `semantic-scholar-research.js` requires `RESEARCH_ROLES` **and** an approved verification request.

### 2.2 What is NOT enforced (gaps / risks)
- **`/api/analytics/*` are unauthenticated and unscoped.** `api/analytics/students.js` and `sessions.js` contain **no** `Authorization`/`Bearer`/role/user check — only `req.method` guards. They aggregate every session in `analytics-report.json`. **Implication:** the instructor analytics page's apparent gating is cosmetic; the data behind it is global and public to anyone who can reach the endpoint. Treat this as a **correctness/authorization defect**, not a missing feature.
- **`ase_readiness_summary` is queried directly from the browser** (`analytics.js` builds a Supabase REST URL with the **anon key** and reads `ase_readiness_summary`). There is **no migration in the repo defining that view/table**, so its existence, columns, and RLS are unverified here. Fragile, undocumented boundary.
- **No instructor→student relationship exists.** `student-progress.js` is strictly self-scoped (`user_id = caller`); nothing lets an instructor read a specific student's progress. "Learner performance" per instructor is **not currently possible** without new data model + authorization.
- **Two parallel analytics stacks** (`worker/` vs `api/`) increase the risk that hardening one leaves the other exposed.

### 2.3 Data model relevant to progress (verified)
- Current attempt/progress data lives in `attempts` / `attempt_answers` (server-authoritative grading). The legacy `question_attempts` table was **retired** by `20260930153300_retire_legacy_student_progress.sql` (fail-closed, dependency-checked drop). Instructor reporting, if built, must read from the current attempt model — **not** the local `analytics-report.json` and **not** the retired table.

### 2.4 Deployment architecture (verified — decisive for the fix)
- **Production runs on Cloudflare Workers** (`wrangler.app.jsonc`, `wrangler.exam.jsonc`, `wrangler.jsonc`). The Worker (`worker/index.js`) registers **no** `/api/analytics/*` route.
- The unauthenticated `/api/analytics/*` handlers are mounted **only** by `torquemind-api/index.js` — a **separate Express app** with its own `package.json` (`"start": "node index.js"`) and **no deploy config in this repo** (no `vercel.json`, `Procfile`, `Dockerfile`, `render.yaml`; only `wrangler.*` exist).
- Consequence: in the deployed Worker, the instructor analytics page's `fetch('/api/analytics/...')` most likely **404s**; the page silently shows placeholders (`—`, `0`). The `analytics-report.json` the handlers read is **not committed**. So today this is a **latent** exposure in a non-deployed Express app, not a live production leak — but it is still a fail-open auth boundary that must be corrected before that app is ever deployed or promoted.

### 2.5 Fail-open authorization in `torquemind-api` (verified)
- `middleware/auth.js`: when **no** `Authorization` header is present it sets `req.user = null` and calls `next()` — it does **not** reject unauthenticated requests (by design, for public assets/health).
- `middleware/requireRole.js`: when Supabase is **not** configured it calls `next()` regardless of user/role; `__tests__/requireRole.test.js` **asserts this fail-open behavior**. When configured, it enforces `req.user.role === role` (401/403).
- `api/telemetry/access.js` `requireInstructor` has a header-only fast path (`x-torquemind-role === 'instructor'`) plus a `resolveUserRole` check.
- Implication (matches the "affiliation ≠ authorization" rule): none of these enforce the **verified-affiliation** signal from `instructor-verification.js`. Role and affiliation are separate concepts and are currently checked in different places, if at all.

### 2.6 Deployment topology determination (repo-grounded; environment still to confirm)

**Evidence from within this repository (all verified):**

| Check | Finding |
| --- | --- |
| Production runtime | Cloudflare Workers only (`wrangler.app.jsonc`, `wrangler.exam.jsonc`, `wrangler.jsonc`). |
| Does the Worker serve `/api/analytics/*`? | **No** — `worker/index.js` registers no analytics route. |
| Is `torquemind-api` deployed by any workflow? | **No** — CI (`api-smoke.yml`, `smoke.yml`) only starts it locally (`nohup npm start`) to run smoke tests. No `wrangler deploy`/host/render/fly/railway/heroku reference exists. |
| Is `torquemind-api` (or `api/`) shipped in the deployed bundle? | **No** — `scripts/build-static-site.js` lists both `api` and `torquemind-api` in `prohibitedOutputEntries`; `validateOutput()` throws if either leaks into `dist/`. |
| Self-description | `torquemind-api/README.md` calls it a *"minimal Express-based backend scaffold"* and states *"For production, add authentication checks, role validation, and input validation."* |
| Maintenance signal | Still referenced by CI and recently dependabot-bumped, so it is **not** deleted/abandoned — it is an **intentionally supported development/legacy scaffold**. |

**Conclusion (repo-grounded):** `torquemind-api` and its unauthenticated `/api/analytics/*` routes are **not part of the deployed production backend**. They are a development/legacy scaffold exercised only in CI. Therefore the unauthenticated analytics routes are a **latent security weakness in an undeployed application — not a live production data leak.** The deployed Worker simply does not expose them.

**What still requires environment verification (outside this repo):**
- Whether `torquemind-api` is deployed to any external host (Railway/Render/Fly/VPS/etc.) whose config lives outside this repository. Absence of config here is strong evidence but not conclusive.
- Whether any external reverse proxy or legacy host still routes `/api/analytics/*` to the Express app.

**Decision gate (per the topology):**
- **If Workers are the only production backend** (current repo evidence): the remediation is to **not promote the scaffold as-is** — either keep the routes fail-closed-by-default for any future use, or retire them. Do **not** rely on them for instructor reporting.
- **If `torquemind-api` is deployed elsewhere** (needs your confirmation): treat the unauthenticated routes as a live security fix — fail closed, remove spoofable header auth, add regression tests.

Either way, instructor-level reporting stays **blocked** until an instructor→student ownership model exists, and `ase_readiness_summary` stays unverified until its DB grants/RLS are confirmed.

---

## 3. Existing data contracts and UI components

### 3.1 Contracts already locked by tests
- `tests/instructor-school-verification-contract.test.js` — locks the affiliation tables, the "never grants a role" invariant, the research role gate, sign-in entry points, build inclusion, and the source-locked institution directory (6547 seeded Federal School Codes, sha256-pinned). **Must remain intact.**
- `tests/instructor-verification-route.test.js` — route-level behavior.
- `tests/instructor/{analytics,live-session,heatmap,replay}.todo.js` — these are **TODO placeholders**, i.e. the analytics/live-session behaviors are **not** currently covered by real tests. Confirms those surfaces are early-stage.

### 3.2 UI components available to reuse
- Canonical `theme/` tokens + components (cards, buttons, tables, stat-card, hero-banner, filter-toolbar, timeline) — same system the Reference Library uses.
- The instructor pages currently mix `theme.css` (legacy) + `theme/tokens.css` + `theme/layout.css` (the hybrid state documented in the token audit). New instructor UI should use the **canonical light token stack** and the shared components, consistent with the Reference Library.
- No classroom/roster/assignment components exist; those would be net-new.

---

## 4. Gaps vs. the proposed instructor experience

| Proposed (concept) | Exists today? | Classification |
| --- | --- | --- |
| Teaching overview (active classes, deadlines, pending assessments) | No | **New functionality** — needs classroom + assignment + review models. |
| Classrooms (students, groups, paths, enrollment) | No | **New functionality** — no instructor→student link exists. |
| Case assignment (assign case, due dates, attempt limits) | No | **New functionality** — no assignment table/route. |
| Assessment review (learner choices, explanations, evidence, feedback history) | Partial concept only | **New functionality** — grading is server-authoritative per-submission; no instructor review queue. |
| Progress insights ("skills to review") | Analytics page exists but is **unscoped/unauthenticated** and reads a local file | **Fix boundary first**, then scope to instructor's students. |
| Content resources (approved teaching materials) | Research/evidence workflow exists | **Exists** (instructor research). |

---

## 5. Screen-by-screen workflow proposal

> Each screen states the **verified** data source it may use today, or marks the contract that must exist first. No screen may imply instructor ownership of data that is not instructor-scoped.

### 5.1 Instructor home (refine `dashboard/instructor/index.html`)
- Keep the affiliation gate exactly as-is (do not weaken it).
- Add a clear status panel: verification state (`pending`/`approved`), institution name, and — only when true — "affiliation verified."
- Tool cards: Analytics, Research Discovery (existing) + placeholders that are **honestly disabled** (e.g. "Classrooms — coming soon") rather than linking to empty pages.
- **Constraint:** must not present aggregate analytics as "your students."

### 5.2 Research discovery (exists — polish only)
- Already role-gated and evidence-governed. Refine visuals on the canonical token stack; no contract change.

### 5.3 Learner progress / analytics (fix boundary, then build)
- **Phase A (required before any reporting):** make `/api/analytics/*` authenticated + instructor-scoped, or replace the page's data source with a new, authorized, instructor-scoped endpoint over the current `attempts`/`attempt_answers` model. Remove the browser-side anon-key read of `ase_readiness_summary` (move it server-side or define + RLS-lock the view).
- **Phase B:** once scoped, render per-instructor metrics with explicit "what was measured" framing (no single-score competence claims), consistent with the concept.

### 5.4 Classrooms / rosters (net-new — separate effort)
- Requires: an instructor↔student enrollment model (migration + RLS), server routes to list/manage a roster, and UI. Not derivable from any current contract.

### 5.5 Case assignment (net-new — separate effort)
- Requires: an assignment entity (case/scenario + lesson, due date, attempt limits, audience), server routes, and UI. The existing `scenario` + `curriculum` data can be referenced, but the assignment relationship does not exist.

### 5.6 Assessment review (net-new — separate effort)
- Requires: an instructor-facing read of attempt/answer/evidence for enrolled students, with authorization ensuring an instructor sees only their own students. Grading stays server-authoritative; review is additive.

---

## 6. Acceptance criteria

- [ ] Affiliation gate behavior is unchanged and still fully covered by `instructor-school-verification-contract.test.js`.
- [ ] No instructor UI presents unscoped/global analytics as instructor-owned data.
- [ ] If analytics remain displayed, the endpoints are authenticated **and** instructor-scoped, with a contract test asserting the authorization boundary (fail-closed on missing/expired token and non-instructor role).
- [ ] Browser-side anon-key reads of `ase_readiness_summary` are removed or replaced by an authorized server path.
- [ ] New instructor UI uses the canonical light token stack (no legacy `theme.css`), matching the Reference Library.
- [ ] Disabled/unbuilt surfaces are honestly labeled, not linked to empty pages.
- [ ] Any net-new capability (classrooms, assignments, review) ships with its own migration + RLS + server authorization + contract test **before** UI.
- [ ] Keyboard/focus/responsive/WCAG 2.2 AA addressed for refined screens (contrast measured in-browser).

---

## 7. Regression risks

- **Weakening the affiliation gate** while "improving" the home screen. Mitigation: treat `instructor-verification.js` + its contract test as frozen unless intentionally changing auth.
- **Accidentally exposing more data** when hardening analytics (e.g. returning all students to any authenticated user). Mitigation: instructor-scoping enforced server-side, with a contract test.
- **Diverging analytics stacks** (`worker/` vs `api/`). Mitigation: pick one boundary for instructor reporting and deprecate the other deliberately.
- **Building UI ahead of contracts** for classrooms/assignments. Mitigation: enforce the staged plan in §8; no UI without a verified data contract.

---

## 8. Staged implementation plan (UI refinement vs. new functionality)

1. **Contract audit + plan** — this document. ✅
2. **Analytics authorization/scoping fix (functionality, small)** — authenticate + scope `/api/analytics/*` (or introduce an authorized instructor-scoped endpoint over `attempts`/`attempt_answers`); remove the anon-key `ase_readiness_summary` browser read. Add contract tests. **No visual redesign yet.**
3. **Instructor home + research visual refinement (UI only)** — canonical token stack, honest status/disabled states. No contract change.
4. **Classrooms / rosters (new functionality)** — migration + RLS + routes + contract tests, then UI.
5. **Case assignment (new functionality)** — assignment model + routes + tests, then UI.
6. **Assessment review (new functionality)** — authorized instructor read of attempts/answers/evidence + tests, then UI.
7. **Browser + accessibility validation** for each refined/added screen (Playwright + manual contrast), mirroring the Reference Library approach.

---

## 9. Open questions for sign-off

1. **Analytics data source of truth:** harden the existing `api/analytics/*` (local JSON) or replace with a live, instructor-scoped endpoint over the current attempt model? (The local-JSON approach cannot represent real per-instructor data.)
2. **`ase_readiness_summary`:** is this view defined outside this repo? If so, confirm its RLS; if not, define + lock it or drop the feature.
3. **Sequencing:** is fixing the analytics authorization boundary (§8 step 2) acceptable as the next code change, ahead of any visual instructor redesign?
4. **Net-new scope:** do classrooms/assignments/review belong in this effort, or should the instructor effort stop at "gate + research + honest status" for now?

---

## 10. Out of scope of this plan

- No changes to the affiliation gate, migrations, or RLS in this document (docs-only).
- No institutional/admin portal work (separate surface).
- No changes to student-facing grading or assessment authority.

---

## 11. Source files reviewed (basis for this plan)

- `worker/routes/instructor-verification.js` — affiliation gate, role resolution, `authorizationGranted`.
- `worker/routes/semantic-scholar-research.js` — research role gate (`RESEARCH_ROLES` + approved).
- `worker/routes/student-progress.js` — self-scoped progress (not an instructor view).
- `worker/index.js` — route registration + CORS/auth headers.
- `api/analytics/{sessions,students,cohort,heatmap,export}.js` — unauthenticated, local-JSON aggregates.
- `dashboard/instructor/{index,index.js,analytics,analytics.js,live-session,*,research/*,session-history,*}` — instructor UI.
- `supabase/migrations/20261001033126_add_instructor_school_verification.sql` — institutions + verification requests (RLS-locked).
- `supabase/migrations/20260930153300_retire_legacy_student_progress.sql` — legacy progress retirement.
- `tests/instructor-school-verification-contract.test.js`, `tests/instructor-verification-route.test.js`, `tests/instructor/*.todo.js` — locked contracts + TODO placeholders.
- `design-language/dashboards/instructor.md` — **empty** (no existing instructor design spec).


