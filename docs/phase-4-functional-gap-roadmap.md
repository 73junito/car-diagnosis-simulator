# AutoLearnPro Functional Gap Roadmap
**Date:** 2026-10-11
**Scope:** Post-Phase-3 functional gap audit across the production app, instructor, institutional, administration, student residuals, authoring, reference/evidence, and public demo surfaces.
**Production app runtime:** `wrangler.app.jsonc` → `worker/index.js` with `./dist` assets.
## Executive finding
Phases 1–3 closed the shared design-token, public-content, and student reasoning-sequence work. The remaining work is no longer primarily visual. The largest gaps are **runtime/API parity, authorization, workflow persistence, institutional tenancy, and administrative review tooling**.
The repository already contains useful foundations, but several exist outside the production Worker or only as browser-local/static shells. The roadmap therefore prioritizes **making existing capabilities production-authoritative before adding net-new portal breadth**.
## What is already functional and should be preserved
- Student scenario delivery, assessment/training separation, server-side grading, approved-question gating, and the five-stage reasoning sequence.
- Student learning-path reads from `/api/curriculum` and `/api/curriculum/references` on the production Worker.
- Instructor institution lookup, institutional-email verification, verification-request creation, and verification-status reads.
- Instructor research discovery and governed curriculum evidence/enhancement workflows on the production Worker.
- Curriculum/reference persistence, evidence governance, assessment eligibility separation, and source-rights controls.
- Classroom tables (`classes`, `enrollments`, `assignments`) and a legacy Express implementation of classroom endpoints.
## Gap inventory
### G1 — Canonical role and authorization model — **P0**
**Evidence:** runtime code currently uses overlapping role names: `teacher`, `instructor`, `professor`, and `admin`. The live-session page checks browser `localStorage` for `instructor`; the legacy classroom API requires `teacher`; Worker research accepts multiple aliases.
**Gap:** there is no single canonical role vocabulary and shared server-side authorization policy across all production routes.
**Required outcome:** define canonical roles and trusted-role resolution once, map legacy aliases explicitly, and make every privileged production route use server-verified identity/role rather than browser state.
### G2 — Production API parity for instructor classroom features — **P0**
**Evidence:** `/api/classes`, `/api/classes/:classId/students`, `/api/classes/:classId/enroll`, `/api/assign`, and `/api/teacher/data` exist in `torquemind-api/index.js`, but are not registered in `worker/index.js`, which is the production app Worker.
**Gap:** classroom persistence exists in Supabase and legacy API code, but the production app surface cannot rely on those endpoints.
**Required outcome:** implement Worker-native, authenticated, ownership-scoped classroom routes using the existing `classes`, `enrollments`, and `assignments` schema; retire or clearly demote the legacy Express routes after parity tests pass.
### G3 — Instructor verification review/decision workflow — **P0**
**Evidence:** production Worker supports lookup, request, and status. `instructor_verification_requests` supports `pending/approved/rejected`, but no app route was found that writes the review decision.
**Gap:** pending instructor affiliation cannot be approved/rejected through a governed application workflow.
**Required outcome:** admin-only review queue, decision endpoint, reviewer identity/timestamp/note enforcement, immutable audit evidence, and tests proving non-admin users cannot decide requests.
### G4 — Instructor workspace completeness — **P1**
**Evidence:** `/dashboard/instructor/` exposes Analytics and Research only. Live Session and Session History exist separately. Classroom/assignment/roster UI is absent.
**Gap:** no coherent instructor home for class creation, roster, assignments, session monitoring/history, and existing research/analytics tools.
**Required outcome:** verified-instructor shell that links only capabilities backed by production APIs; add Classes, Roster, Assignments, Live Session, Session History, Analytics, Research, and Authoring progressively as each backend is authoritative.
### G5 — Instructor analytics production data boundary — **P0/P1**
**Evidence:** `dashboard/instructor/analytics.js` calls `/api/analytics/students` and `/api/analytics/export`; these implementations are Node/CommonJS handlers under `api/analytics/` and are not registered in `worker/index.js`. They aggregate local report files and include fallback empty exports.
**Gap:** the current analytics UI does not have a clearly Worker-native, institution/class-scoped production data contract.
**Required outcome:** Worker-native analytics endpoints derived from authorized Supabase data, scoped to instructor-owned classes/institution permissions; no static report fallback in production; export authorization and row-level privacy tests.
### G6 — Live session and session history authorization/runtime — **P0/P1**
**Evidence:** live-session access is gated by `localStorage.getItem('torquemindRole')`; it opens `/api/telemetry/stream`. Session history calls `/api/telemetry/history` and export endpoints. No telemetry routes are registered in `worker/index.js`.
**Gap:** privileged monitoring/history relies on browser role state and non-Worker API surfaces.
**Required outcome:** Worker-native telemetry/history/export routes with verified instructor/admin authorization and class/institution scoping; replace browser-role gating with server authorization; add SSE authorization/reconnect tests.
### G7 — Server-backed Authoring Studio — **P1**
**Evidence:** `dashboard/author/` is a substantial UI, but its scenario library is stored in `localStorage`; no production auth gate or server draft/publish API was found.
**Gap:** drafts are browser-local, not collaborative/auditable, and the page cannot participate in governed review/publication.
**Required outcome:** verified-author role boundary; Supabase-backed drafts/versions; autosave; ownership; review state; evidence/source linkage; explicit publish approval; publication must never silently grant assessment eligibility.
### G8 — Institutional tenant model and portal — **P1/P2**
**Evidence:** `institutions`, email domains, verification requests, student institution claims, classroom tables, and institution search exist. No `/dashboard/institution/` portal or institution-membership/tenant administration model exists.
**Gap:** an institution is currently a directory/verification record, not an administrable tenant.
**Required outcome:** institution memberships and roles; organization-scoped programs/cohorts/classes; institution administrators; membership invitations/removal; institution settings; verified domains; institution-level reporting; strict tenant isolation/RLS.
### G9 — Student institution-claim review/status workflow — **P1/P2**
**Evidence:** student signup can create `student_institution_claims`, which support `claimed/verified/rejected`; no production review/status UI or decision endpoint was found.
**Gap:** student institution affiliation is captured but not operationally managed end-to-end.
**Required outcome:** student claim-status read, institution/admin review queue, decision API, reviewer audit metadata, and linkage to institution membership only after approval.
### G10 — Platform administration dashboard — **P1/P2**
**Evidence:** `dashboard/admin` does not exist; `design-language/dashboards/administrator.md` is currently empty. Admin is recognized by some backend authorization checks but has no operational UI.
**Gap:** no central surface for privileged operations.
**Required outcome:** `/dashboard/admin/` with least-privilege modules for instructor verification, student institution claims, users/roles, institution/domain administration, content/evidence review queues, audit history, and operational configuration. High-risk actions require explicit confirmation and server audit records.
### G11 — Student transcript is a static shell — **P2**
**Evidence:** `/dashboard/student/transcript/` renders hard-coded zero/placeholder metrics and has no live fetch.
**Gap:** no authoritative student transcript/progress-history presentation.
**Required outcome:** authenticated student-scoped transcript endpoint/UI derived from trusted progress/attempt records; distinguish practice from assessment; do not imply credentials or academic credit unless separately authorized.
### G12 — Student activity is a static shell — **P2**
**Evidence:** `/dashboard/student/activity/` contains hard-coded timeline entries and no live data fetch.
**Gap:** recent activity is illustrative rather than user-specific.
**Required outcome:** authenticated student-scoped activity feed from approved event/progress sources, with pagination/retention boundaries and no exposure of grading secrets.
### G13 — Student Coach is static while recommendation API exists — **P2**
**Evidence:** Coach currently displays a fixed “Recommended next: Charging System” message; production Worker already exposes `/api/student/recommendations`.
**Gap:** the UI does not consume the server recommendation boundary.
**Required outcome:** authenticated recommendation rendering with unavailable/empty states, provenance/context labels, and no client exposure of protected correctness/audit fields.
### G14 — Dedicated governed reference-library experience — **P2**
**Evidence:** curriculum references are available through `/api/curriculum/references` and instructor research has discovery/review tooling; public Research Sources is informational. There is no dedicated browse/search library for permitted learner/instructor references.
**Gap:** governed references are data-backed but not exposed as a coherent library experience.
**Required outcome:** audience-aware reference browse/search/filter UI using existing rights fields; link-only sources remain link-only; no unauthorized RAG/database use.
### G15 — Public interactive demo case — **P3**
**Evidence:** the redesign audit explicitly leaves the interactive demo case as a new build.
**Gap:** public visitors cannot experience a safe sample of the reasoning model before sign-in.
**Required outcome:** one deterministic, non-graded, non-personalized demo using public-safe synthetic/cleared content. It must not expose assessment banks, answer keys, private telemetry, or imply accreditation/credit.
### G16 — Empty instructor/admin design specifications — **P2 documentation dependency**
**Evidence:** `design-language/dashboards/instructor.md` and `administrator.md` are zero-byte files.
**Gap:** functional implementation lacks an authoritative information architecture/interaction contract for the two highest-privilege surfaces.
**Required outcome:** write role-specific dashboard specs before broad UI implementation, including authorization states, empty/error states, destructive-action confirmation, audit visibility, and responsive behavior.
### G17 — Duplicate runtime/API architecture — **P1 architectural debt**
**Evidence:** active capabilities are split among Worker routes, Node/Vercel-style `api/`, and `torquemind-api` Express routes.
**Gap:** tests can pass against handlers that are not reachable on the production app Worker, creating false confidence about feature availability.
**Required outcome:** define `worker/index.js` as the canonical production API boundary for `app.autolearnpro.com`; add a CI contract that every browser-called `/api/*` route is either registered on that Worker or explicitly routed to another documented production service.
## Recommended execution order
### Phase 4A — Authorization and runtime foundation
1. [x] Canonical role taxonomy + shared trusted-role resolver.
2. Production API route inventory contract.
3. Instructor verification decision API + audit record.
4. Admin verification-review minimum UI.
**Why first:** every later institutional/instructor/admin capability depends on trusted authorization and a real operational approval path.
### Phase 4B — Instructor classroom core
1. Port classes/list/create to Worker.
2. Port enroll/roster to Worker.
3. Port assignments to Worker.
4. Build instructor Classes/Roster/Assignments UI.
5. Add ownership and cross-class isolation tests.
### Phase 4C — Instructor analytics and monitoring
1. Worker-native scoped analytics summary/students/export.
2. Worker-native telemetry history/export/stream.
3. Replace live-session browser role gate.
4. Integrate Live Session and Session History into instructor home.
### Phase 4D — Governed authoring
1. Author role/access decision.
2. Server-backed drafts and versioning.
3. Evidence linkage and review states.
4. Explicit publication workflow separate from assessment eligibility.
### Phase 5 — Institutional portal
1. Institution membership/role schema.
2. Student-claim review and instructor-request administration.
3. Programs/cohorts/classes aggregation.
4. Institution reporting/settings/domain management.
5. Tenant-isolation security suite.
### Phase 6 — Platform administration
1. Admin dashboard shell/spec.
2. Verification/claim queues.
3. Users/roles/institutions.
4. Governance review queues and audit history.
5. Operational settings with audited changes.
### Phase 7 — Student residual functionality
1. Live Coach recommendations.
2. Live Transcript.
3. Live Activity.
4. Institution claim status.
5. Dedicated governed Reference Library.
### Phase 8 — Public interactive demo
Build only after the production reasoning flow and reference/authorization boundaries are stable.
## Branch plan
Use one concern per branch/PR. Suggested first branches:
- `security/canonical-role-policy`
- `test/production-api-route-inventory`
- `feat/admin-instructor-verification-review`
- `feat/worker-classroom-classes`
- `feat/worker-classroom-roster`
- `feat/worker-classroom-assignments`
- `feat/instructor-classroom-ui`
- `feat/worker-instructor-analytics`
- `feat/worker-instructor-telemetry`
- `feat/authoring-server-drafts`
- `feat/institution-membership-model`
- `feat/admin-dashboard-shell`
- `feat/student-live-coach`
- `feat/student-transcript`
- `feat/student-activity`
- `feat/reference-library`
- `feat/public-demo-case`
## Non-negotiable acceptance rules
- No browser role/localStorage value can authorize privileged data.
- No institution identifier or email-domain match alone grants instructor/institution-admin access.
- All cross-user/institution reads are server-authorized and tenant/class scoped.
- Assessment eligibility remains separate from training visibility, publication, curriculum inclusion, or evidence approval.
- No new feature may expose answer keys, `is_correct` audit data, service-role credentials, or protected provenance.
- Every browser-called production API route must have a deployment-path test proving it exists on the intended runtime.
- Empty/unavailable states must be truthful; do not substitute sample data on authenticated production dashboards.
- Generated reports/files remain unstaged unless they are intentional evidence artifacts.
## First implementation target
G1 is complete. Next implement **Phase 4A / G3**: the missing admin-only instructor-verification decision workflow, using the shared canonical role policy established by G1.