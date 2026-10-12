# AutoLearnPro Functional Gap Roadmap
**Date:** 2026-10-11
**Scope:** Post-Phase-3 functional gap audit across the production app, instructor, institutional, administration, student residuals, authoring, reference/evidence, and public demo surfaces.
**Production app runtime:** `wrangler.app.jsonc` -> `worker/index.js` with `./dist` assets.
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
### G1 - Canonical role and authorization model - **P0 - completed**
**Evidence:** runtime code currently uses overlapping role names: `teacher`, `instructor`, `professor`, and `admin`. The live-session page checks browser `localStorage` for `instructor`; the legacy classroom API requires `teacher`; Worker research accepts multiple aliases.
**Gap:** there is no single canonical role vocabulary and shared server-side authorization policy across all production routes.
**Required outcome:** define canonical roles and trusted-role resolution once, map legacy aliases explicitly, and make every privileged production route use server-verified identity/role rather than browser state.
### G2 — Production API parity for instructor classroom features — **P0 - completed**
**Evidence:** `/api/classes`, `/api/classes/:classId/students`, `/api/classes/:classId/enroll`, `/api/assign`, and `/api/teacher/data` exist in `torquemind-api/index.js`, but are not registered in `worker/index.js`, which is the production app Worker.
**Gap:** closed for the classroom core. Class list/create, authenticated class-code lookup, self-enrollment, owner-scoped roster, assignment creation, and instructor classroom UI are Worker-native. The legacy teacher aggregate remains only in the legacy Express scaffold and is no longer referenced by production browser assets.
**Required outcome:** completed for G2. Production classroom flows use Worker-native authenticated, ownership-scoped routes. Legacy `/api/teacher/data` is demoted to the non-production Express scaffold and production code is contract-tested not to reference it. Legacy `/api/complete` and `/api/replay` production browser writes are retired; local training UX remains browser-assisted and assessment records remain server-authoritative.
### G3 - Instructor verification review/decision workflow - **P0 - completed**
**Evidence:** production Worker supports lookup, request, and status. `instructor_verification_requests` supports `pending/approved/rejected`, but no app route was found that writes the review decision.
**Gap:** pending instructor affiliation cannot be approved/rejected through a governed application workflow.
**Required outcome:** admin-only review queue, decision endpoint, reviewer identity/timestamp/note enforcement, immutable audit evidence, and tests proving non-admin users cannot decide requests.
### G4 — Instructor workspace completeness — **P1 - completed**
**Evidence:** `/dashboard/instructor/` exposes Analytics and Research only. Live Session and Session History exist separately. Classroom/assignment/roster UI is absent.
**Gap:** closed for currently authoritative instructor capabilities. The verified instructor home links Classes & Assignments, Live Session, Session History, Analytics, Research Discovery, and the G7 private-draft Authoring Studio from one operational shell. Authoring is explicitly draft-only until the remaining G7 review/publication controls exist.
**Required outcome:** completed for production-backed capabilities. The shell exposes only verified, governed instructor features and labels Authoring as private drafts with review/publication unavailable.
### G5 — Instructor analytics production data boundary — **P0/P1 - completed**
**Evidence:** `dashboard/instructor/analytics.js` calls `/api/analytics/students` and `/api/analytics/export`; these implementations are Node/CommonJS handlers under `api/analytics/` and are not registered in `worker/index.js`. They aggregate local report files and include fallback empty exports.
**Gap:** closed. Student analytics, session summary, and analytics export are Worker-native and class-scoped through instructor-owned classes. The optional legacy CTA summary caller and its unscoped fallbacks have been retired.
**Required outcome:** completed. Student analytics, session summary, and CSV/xAPI export are derived from authorized Supabase enrollment/attempt data, scoped to instructor-owned classes, and production CTA code no longer calls legacy or unscoped analytics endpoints.
### G6 — Live session and session history authorization/runtime — **P0/P1**
**Evidence:** live-session access is gated by `localStorage.getItem('torquemindRole')`; it opens `/api/telemetry/stream`. Session history calls `/api/telemetry/history` and export endpoints. No telemetry routes are registered in `worker/index.js`.
**Gap:** closed. Session history, export, ingestion, and the live class-scoped telemetry stream are Worker-native; live-session browser authorization now relies on the canonical bearer token and server-side instructor/class ownership checks.
**Required outcome:** completed. History/export and live stream use verified instructor authorization plus owned-class enrollment scope; ingestion enforces the approved scenario_started-only payload contract and derives authenticated identity server-side. The live browser uses authenticated fetch-based SSE snapshots with cursor reconnects instead of localStorage role trust or an in-memory Worker broadcast bus.
### G7 — Server-backed Authoring Studio — **P1**
**Evidence:** `dashboard/author/` is a substantial UI, but its scenario library is stored in `localStorage`; no production auth gate or server draft/publish API was found.
**Gap:** partially closed. Browser-local draft persistence has been retired. Verified instructors and admins now receive an owner-scoped, service-role-mediated scenario draft API backed by `scenario_authoring_drafts`, with server versions and private draft-only state. The remaining G7 work is autosave, evidence/source linkage, review state, and explicit publication approval.
**Required outcome:** verified-author access decision completed for the current instructor/admin model; Supabase-backed ownership/versioning completed. Remaining: autosave, governed review/evidence linkage, and publication workflow. Publication must never silently grant assessment eligibility.
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
**Gap:** governed references are data-backed but not exposed as a coherent library experience. The dead student `/api/approved-sources` compatibility fetch has been retired; G14 remains open for the dedicated browse/search library experience and should use the existing `/api/curriculum/references` boundary rather than restoring that legacy route.
**Required outcome:** audience-aware reference browse/search/filter UI using existing rights fields; link-only sources remain link-only; no unauthorized RAG/database use.
### G15 — Public interactive demo case — **P3**
**Evidence:** the redesign audit explicitly leaves the interactive demo case as a new build.
**Gap:** public visitors cannot experience a safe sample of the reasoning model before sign-in.
**Required outcome:** one deterministic, non-graded, non-personalized demo using public-safe synthetic/cleared content. It must not expose assessment banks, answer keys, private telemetry, or imply accreditation/credit.
### G16 — Empty instructor/admin design specifications — **P2 documentation dependency**
**Evidence:** `design-language/dashboards/instructor.md` and `administrator.md` are zero-byte files.
**Gap:** functional implementation lacks an authoritative information architecture/interaction contract for the two highest-privilege surfaces.
**Required outcome:** write role-specific dashboard specs before broad UI implementation, including authorization states, empty/error states, destructive-action confirmation, audit visibility, and responsive behavior.
### G17 — Duplicate runtime/API architecture — **P1 - completed**
**Evidence:** active capabilities are split among Worker routes, Node/Vercel-style `api/`, and `torquemind-api` Express routes.
**Gap:** closed for production browser API parity. The client-authored `/api/attempts/save`, `/api/complete`, and `/api/replay` writes were retired instead of ported because they depended on browser-controlled identity, result, or score data. Training progress/replay remains browser-assisted where allowed; assessment attempt creation, grading, and finalization boundaries remain server-authoritative.
**Required outcome:** completed. `worker/index.js` is the canonical production API boundary for `app.autolearnpro.com`; every API literal shipped by the production build resolves to a Worker route, and `config/production-api-route-inventory.json` contains zero known gaps.
### G18 - Supabase migration deployment parity and environment drift - **P0 - completed**
**Evidence:** the audit found staging at 44 recorded migrations while production and the repository were at 107. G18 synchronized the missing logical schema/governance chain to staging, restored the 6,547-row federal school-code seed, added a service-role-only migration-history RPC to staging and production, and added deterministic CI drift detection against the repository baseline. Staging retains one documented exception: the production-specific historical smoke-data cleanup whose fail-closed guard expects 2,206 smoke classes plus `scenario_assignments`, while staging has 964 smoke-only classes, no enrollment/assignment links, and no `scenario_assignments` table.
**Gap:** closed for the current staging baseline. PR CI now fails when staging is missing any non-exempt logical migration already present on `main`; post-merge/main checks compare staging against `HEAD`.
**Required outcome:** completed with staging logical migration synchronization, one count-limited documented exception, locked-down migration-history RPCs, a project-ref-pinned drift verifier, and a staging CI workflow. Schema-dependent endpoints continue to fail closed when their required migration is absent.

### G19 - Supabase SECURITY DEFINER RPC exposure hardening - **P0 - completed**
**Evidence:** the post-sync Supabase security advisor reports `public.capture_student_institution_claim()` and `public.handle_new_auth_user()` as `SECURITY DEFINER` functions directly executable by both `anon` and `authenticated`. It also reports one mutable-search-path function, `public.set_external_data_resource_updated_at`.
**Gap:** closed for the three trigger/helper functions identified by the staging advisor. Direct `PUBLIC`/`anon`/`authenticated` execution is revoked and all three functions have an empty pinned `search_path`.
**Required outcome:** completed. Staging transactional verification confirmed profile creation, student institution-claim creation, and external-resource timestamp trigger execution still work; staging and production security-advisor/privilege checks confirm the original G19 warnings are cleared.

### G20 - Provenance RLS helper isolation and legacy DB parity - **P1 - completed**
**Evidence:** production previously retained legacy `authenticated` provenance RLS policies backed by `public.is_provenance_admin()` and `public.is_provenance_reviewer()`, while the active Worker already accessed the governed provenance tables only through the service role and staging already used a service-role-only table boundary.
**Gap:** closed. The legacy direct-browser provenance policy surface was retired rather than copied into staging. Both staging and production now revoke `anon`/`authenticated` table privileges on the governed provenance tables, expose no provenance role-check `SECURITY DEFINER` RPCs, and record the same canonical G20 migration. The empty production `provenance_audit` table is preserved as legacy data structure pending separate disposition review.
**Required outcome:** completed. Active provenance reads/writes remain Worker/service-role mediated; the legacy `db/migrations` helper/policy surface is historical only and is superseded by the canonical `supabase/migrations/20261012083703_retire_provenance_rls_helpers.sql` hardening migration.

## Recommended execution order
### Phase 4A — Authorization and runtime foundation
1. [x] Canonical role taxonomy + shared trusted-role resolver.
2. [x] Production API route inventory contract.
3. [x] Instructor verification decision API + audit record.
4. [x] Admin verification-review minimum UI.
5. [x] Supabase migration drift detection and staging synchronization (G18).
6. [x] Supabase SECURITY DEFINER RPC exposure hardening (G19).
7. [x] Provenance RLS helper isolation and legacy DB parity (G20).
**Why first:** every later institutional/instructor/admin capability depends on trusted authorization and a real operational approval path.
### Phase 4B — Instructor classroom core
1. [x] Port classes/list/create to Worker.
2. [x] Port enroll/roster to Worker.
3. [x] Port assignments to Worker.
4. [x] Build instructor Classes/Roster/Assignments UI.
5. [x] Add ownership and cross-class isolation tests.
### Phase 4C — Instructor analytics and monitoring
1. [x] Worker-native scoped analytics: students, session summary, export, and legacy summary-caller retirement.
2. Worker-native telemetry: [x] history; [x] export; [x] ingestion; [x] live stream.
3. [x] Replace live-session browser role gate.
4. [x] Integrate Live Session and Session History into instructor home.
### Phase 4D — Governed authoring
1. [x] Author role/access decision: verified instructor or admin; no new browser-trusted role.
2. [x] Server-backed private drafts and optimistic versioning.
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
G1, G3, G18, G19, and the Phase 4A production API route inventory contract are complete. **Phase 4B / G2 is complete:** Worker-native class list/create, authenticated lookup, self-enrollment, owner-scoped roster, assignment creation, instructor classroom UI, isolation contracts, and production retirement of the legacy teacher aggregate are in place. G17 production route parity is complete; legacy completion/replay tables remain separate data-disposition work and are not active browser persistence targets. G20 provenance/RLS helper exposure is closed; broader institutional rollout should continue from the service-role-only governed provenance boundary.
