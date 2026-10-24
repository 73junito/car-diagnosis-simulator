# Gate D — Independent Security Review Handoff

**Status: review required. This document is not an approval, and it is not written by an
independent party.**

Everything referenced here was produced by the same agent that authored the corrective
migration's evidence. A verdict from that agent would be self-review and would carry no
independent weight. This handoff exists so a reviewer who did not write the work can
reach a verdict efficiently and can see where the evidence is thinner than it looks.

## Scope of the review

Three distinct security boundaries. They fail differently, and passing one says nothing
about the others.

| # | Boundary | Enforced by | If it fails |
| --- | --- | --- | --- |
| 1 | Direct PostgreSQL grants and RLS | Table privileges, RLS policies | A browser session reaches data it must not |
| 2 | Service-role application authorization | Route code only — RLS is bypassed | Any student or instructor reaches any record |
| 3 | Cross-institution tenant isolation | Route code, keyed on `school_code` | One institution reaches another's records |

Boundary 2 is the one to weight most heavily: the service role bypasses RLS, so a mistake
there is invisible to every table-privilege control in this package.

## Evidence index

| Artifact | Asserts | Reproduce |
| --- | --- | --- |
| `scripts/sql/gate-d-security-inventory.sql` | Read-only inventory of tables, columns, sequences, routines, views, default ACLs, `SECURITY DEFINER` | `node scripts/validate-gate-d-inventory.js` |
| `scripts/sql/gate-d-security-inventory-fixtures.sql` | Positive and negative control per object kind | via the same runner |
| `scripts/validate-gate-d-against-manifest.js` | Observed privileges equal `docs/database/table-access-policy.json` for 75 tables × 2 roles | `node scripts/validate-gate-d-against-manifest.js` |
| `scripts/sql/gate-d-authorization-matrix.sql` | 35 authorization and tenancy cases, including 8 two-institution isolation cases against the service-role query path; every denial asserts SQLSTATE `42501` and its specific message; 10 classifier controls | `node scripts/validate-gate-d-authorization.js` |
| `tests/gate-d-institution-reporting-authorization.test.js` | `handleInstitutionAdminReport` rejects missing, invalid, forged and cross-institution codes and role escalation | `npx jest tests/gate-d-institution-reporting-authorization.test.js` |
| `tests/gate-d-classroom-route-tenant-isolation.test.js` | The classroom routes scope every service-role query to the caller; a caller cannot reach another instructor's or another institution's data | `npx jest tests/gate-d-classroom-route-tenant-isolation.test.js` |
| `tests/gate-d-institution-route-tenant-isolation.test.js` | The institution routes scope every service-role query to the caller's verified institution; a caller cannot reach another institution's portal, settings, members or claims | `npx jest tests/gate-d-institution-route-tenant-isolation.test.js` |
| `supabase/migrations/20261022000000_enforce_least_privilege_public_schema.sql` | The change under review | — |
| `docs/database/table-access-policy.json` | The intended contract | — |
| `docs/database/least-privilege-migration-security-note.md` | Residual sequence and routine exposure | — |

All runners apply the canonical chain to a digest-pinned Supabase PostgreSQL 17 container
with `--network none`, no published ports, no host mounts, `ON_ERROR_STOP=1`, and teardown
by container id. No staging or production credential is present and no student or
application data is used.

Image provenance is established from `docker image inspect`, not from the container
inspection. A container inspection carries no digest metadata at all, and the image id it
reports is the platform configuration id, which differs from the pinned digest whenever the
pinned digest is a manifest list. The harness therefore requires the running image to be
the image the approved digest resolves to, corroborated by the digest metadata the image
store records, and fails closed when neither can be established.

Two independent implementations of that correction reached this branch: one keyed on
`RepoDigests` alone (approved repository plus digest) and one correlating the inspected
image id with the image the approved digest resolves to. The retained form is the second,
deliberately. A `RepoDigests`-only rule requires the image store to record the approved
repository and digest, which does not hold on a workstation single-platform pull, where the
recorded digest is the platform configuration id rather than the pinned manifest digest.
The retained proof does not depend on the image store recording digest metadata at all.

The last failing CI job on this branch, `tests/ci-postgres-service-image.test.js`, was not
a live defect. The repository digest-policy verifier requires the pinned digest on every
non-comment workflow line containing the Supabase image marker, and the GHCR auth
diagnostic needs a grep pattern to find the approved reference in another workflow; written
as a single literal, that pattern reads as an unpinned reference. `main` already carries the
correction (`f2bffeee`, #1114), which assembles the pattern from parts so the effective ERE
is byte-identical, carves no exemption into the policy, and leaves the validator untouched.
This branch was three commits behind `main` and did not contain it; merging `main` resolved
the failure. The verifier now exits 0 here.

## Boundary 1 — direct grants and RLS

**Established.** All 12 institution and tenant tables carry `anon=[]` and `authenticated=[]`.
`anon` holds no grant anywhere in the manifest. The nine classroom tables carry exactly the
privileges the manifest specifies, verified by an instrument independent of the one that
wrote the manifest: 150 role comparisons, zero mismatches.

**Limits.** A privilege set matching its manifest proves the migration did what it intended,
not that the intent is correct. The manifest itself is the claim under review.

**Reconciled — the default-privilege claim.** The #1103 description stated that the
default-privilege change applied to **both** definer roles (`supabase_admin` and `postgres`),
and that the verification table showed `anon`/`authenticated` absent from `pg_default_acl`
for both. Neither was true, and the discrepancy was in the description rather than in the
migration. The migration uses the current-role form, so it applies to whichever role runs
it (`postgres` in the disposable validation); `ALTER DEFAULT PRIVILEGES FOR ROLE
supabase_admin` is refused with SQLSTATE 42501 because Supabase manages that role. The
`supabase_admin` per-schema `public` defaults are therefore unchanged, and the migration
itself records them as a platform-managed residual rather than papering over them. The
description has been corrected to say so. No code, migration or manifest changed.

**Open questions.** Are the nine authenticated grants the complete, approved application
access contract? Is `DELETE` on `classes` and `syllabi` intended for the `authenticated`
role, or should deletion be service-role only?

## Boundary 2 — service-role authorization

**Established.** `worker/routes/classroom-*.js` and `worker/routes/institution-reporting.js`
use a service-role client after `verifySupabaseToken`, and the institution route resolves
membership by `school_code` + `user_id` + `status='active'` before requiring an admin or
owner role. Ten runtime cases confirm rejection of missing, invalid and forged credentials,
malformed codes, role escalation and cross-institution codes — each asserting that **no
reporting query ran**.

**Established for the classroom routes.** `tests/gate-d-classroom-route-tenant-isolation.test.js`
drives the real `handleListClasses`, `handleCreateClass`, `handleFindClassByCode`,
`handleEnrollInClass`, `handleClassRoster` and `handleCreateAssignment` handlers against a
stubbed data layer that **applies the filters the route asks for**, so a route that drops a
scope sees the row it must not see, exactly as the database would hand it back. Thirteen
cases establish that:

- a caller whose trusted role is not an instructor is refused before any class data is read;
- the class list is scoped by `owner_id`, is never widened by a school code, and contains
  only the caller's own classes — another instructor's class in another institution is
  absent from the response;
- a roster and an assignment for a class the caller does not own are refused, and no
  enrollment, profile or assignment row is read or written for them;
- a class can only be created for an institution the caller holds an **active** membership
  in, the school code written on the class comes from that verified membership rather than
  from the request body, and the membership check completes before any class data is
  touched;
- the enrollment lookup is scoped to the caller's own class, a student who is not enrolled in
  that class cannot be targeted, and an enrollment is only ever written for the authenticated
  caller;
- the join-by-code path, which crosses institutions on purpose, returns only the class id and
  name.

**Established for the institution routes.** `tests/gate-d-institution-route-tenant-isolation.test.js`
drives the real handlers of `institution-portal.js`, `institution-settings-domains.js`,
`institution-membership-admin.js`, `student-institution-claims.js` and
`institution-search.js` against the same filter-applying stub. Sixteen cases establish
that:

- the institution portal, the member list and the settings read or write are refused
  unless the caller holds an **active** membership in the institution being read, and the
  refusal happens before any tenant table is read;
- every portal, settings, member-list and claim-queue query carries the **verified** school
  code, and the membership is always resolved for the caller's own user id, so another
  administrator of the same institution cannot stand in for them;
- an instructor sees only the classes they own, while an institution administrator sees
  their own institution's classes and never another institution's;
- a student reads only their own claim, and a claim reviewer sees only the claims of the
  institutions they administer;
- the institution search route is deliberately unauthenticated — it is the directory a
  student uses to find the institution to apply to — so it returns active institutions only
  and no member, class or settings data.

Each of those controls was mutation-tested: removing the membership `user_id` scope, the
active-status filter, the instructor owner scope, the settings forbidden check, the claim
queue school-code scope, the claim status user scope, the member-list school-code scope or
the search active filter each fails at least one case.

The remaining mutating handlers of the institution routes — the email-domain decisions, the
invitation and member decisions, and the claim decision — are not yet covered and remain
open.

Each of those controls was mutation-tested. Removing the class owner scope, the membership
`user_id` scope, the active-status filter, the assignment owner scope, the enrollment class
scope or the enrollment membership check, and sourcing the school code from the request body
instead of the verified membership, each fails at least one case. The suite is therefore
load-bearing rather than vacuous.

**Limits.** The runtime tests use a **stubbed data layer**. They prove the route's decision
logic, not its behaviour against a real database. The route trace was static.

**Open questions.** Does every service-role query in every route carry a tenant or user
scope, or are there paths that read broadly and filter afterwards? Is there any route that
returns data before completing its membership check? — Both are now answered for the
classroom routes, the institution routes and the institution-reporting route, for the
handlers listed above. The mutating handlers listed above remain open.

## Boundary 3 — cross-institution isolation

**Established at the database boundary.** A client role cannot read or write any institution
record at all, so cross-tenant access from a browser is impossible by construction.

**Established end-to-end against the service-role query path.** The matrix seeds two
institutions with separate administrators, memberships, programs and classes, then asserts
eight cases using the same query shape the reporting route uses:

- `service_role` is confirmed to bypass RLS, so the tenant scope is load-bearing rather than
  a policy that happens to filter.
- An unscoped service-role read sees **both** institutions (2 rows) — the exposure the
  route's scope exists to prevent.
- A scoped read returns only the caller's institution (1 row), and supplying the other
  institution's class identifier under that scope returns 0 rows.
- Membership resolution returns 1 row for the caller's own institution and 0 rows for a
  forged institution code, so a forged code fails closed.
- A cross-tenant class creation and a class linked to another institution's program are both
  **rejected by the database** (SQLSTATE `P0001`) by a trigger on `classes` that requires the
  class owner to hold an active membership in the claimed institution and requires any
  linked program or cohort to belong to the same institution.

That last point is a genuine second line of defence: the rejection is enforced by the
database and is **not** bypassed by `service_role`.

**Established at the route layer for the classroom routes.** The route coverage above proves
the same isolation through the handlers that serve it: an instructor of one institution
cannot list, read the roster of, or create an assignment on a class owned by an instructor
of another institution, because those queries carry the caller's `owner_id` scope instead of
reading broadly and filtering afterwards. A class may only be attributed to an institution
the caller holds an active membership in, and the school code is taken from that verified
membership rather than from the request. The database trigger above independently rejects a
cross-tenant class creation, so the classroom routes carry two layers.

**Limits.** This exercises the real query path against a real database, but it does not call
the route handler — the route's decision logic is covered by the stubbed runtime tests
above, for the classroom and institution-reporting routes only. The identities and codes are
synthetic and fixed, so there is no coverage of concurrent requests, policy subqueries, or a
live Supabase deployment with connection pooling or PostgREST.

**Open questions.** Does every service-role query in every route carry the same tenant
scope that this test exercises for `classes`? `classes` has an explicit cross-tenant
trigger; other tenant tables have no equivalent, so their isolation rests on the route
scope alone. Is an omitted `school_code` guaranteed to fail closed on every path? — The
classroom and institution routes now have route-level coverage; the mutating handlers
listed under Boundary 2 are not yet covered.

## Where this evidence is weaker than it may appear

- The runtime route test stubs the data layer.
- The two-institution isolation test exercises the service-role query path, not the route
  handler that calls it, and it covers `classes`; other tenant tables have no equivalent
  cross-tenant trigger, so their isolation rests on the route scope alone. The classroom and
  institution routes now carry route-level coverage, but only `classes`, `enrollments`,
  `assignments`, `institution_memberships`, `institution_settings`, `institution_programs`,
  `institution_cohorts`, `institutions` and `student_institution_claims` are exercised, and
  the mutating handlers listed above are not.
- 66 of 75 tables grant `authenticated` nothing — correct for a service-role-only model, but
  any unexamined student read path using `authenticated` against them will fail.
- The classifier controls prove the assertions reject misclassification; they do not prove
  the cases exercise every reachable code path.
- The residual sequence and routine grants (8 sequence `USAGE`, 4 routine `EXECUTE`) are now
  enumerated and attributed to specific migrations, but they are still **not remediated**:
  the manifest and the audit cover tables only, so they sit outside the reviewed privilege
  set. The enumeration is read-only; no revoke is proposed here.
- Nothing here exercises a real Supabase deployment, connection pooling, or PostgREST.

## Deployment gates that are not security findings

A favourable security verdict does **not** satisfy these, and none of them is addressed by
any test in this package:

- Staging migration-history reconciliation.
- A verified restorable staging backup.
- A documented and tested rollback.
- Separate authorization before executing any staging migration.

The local PostgreSQL migration divergence is also separate from the hosted staging
migration-parity failure. Resolving one does not resolve the other.

**Diagnosed — the staging migration-parity failure is not caused by #1103.** The failing
`staging migration parity` check reports that the staging project
`jchfruprqpeypdttvlam` is missing one canonical migration,
`20261013190000_retire_external_certification_taxonomy.sql`, against a baseline of 106
migrations on `main` (`53ebf0f7`). That migration is present on `main` and on the #1103
branch, and it is **not** part of the #1103 diff, so the branch cannot be the cause: the
staging project simply has not applied a migration that `main` already carries. The check
compares staging against `main` rather than against the pull request, which is why it
appears on this branch. `production migration parity` passes, so the two environments
differ. Closing this requires applying the outstanding canonical migration to staging,
which is a deployment action and is deliberately not taken here.

## Required output

An explicit approval or rejection, with conditions if any, stating for each of the three
boundaries whether it is satisfied, unsatisfied, or unverified. "Tests pass" is not a
verdict.

