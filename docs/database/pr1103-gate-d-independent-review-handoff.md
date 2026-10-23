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
| `scripts/sql/gate-d-authorization-matrix.sql` | 27 authorization cases; every denial asserts SQLSTATE `42501` and its specific message; 10 classifier controls | `node scripts/validate-gate-d-authorization.js` |
| `tests/gate-d-institution-reporting-authorization.test.js` | `handleInstitutionAdminReport` rejects missing, invalid, forged and cross-institution codes and role escalation | `npx jest tests/gate-d-institution-reporting-authorization.test.js` |
| `supabase/migrations/20261022000000_enforce_least_privilege_public_schema.sql` | The change under review | — |
| `docs/database/table-access-policy.json` | The intended contract | — |
| `docs/database/least-privilege-migration-security-note.md` | Residual sequence and routine exposure | — |

All runners apply the canonical chain to a digest-pinned Supabase PostgreSQL 17 container
with `--network none`, no published ports, no host mounts, `ON_ERROR_STOP=1`, and teardown
by container id. No staging or production credential is present and no student or
application data is used.

## Boundary 1 — direct grants and RLS

**Established.** All 12 institution and tenant tables carry `anon=[]` and `authenticated=[]`.
`anon` holds no grant anywhere in the manifest. The nine classroom tables carry exactly the
privileges the manifest specifies, verified by an instrument independent of the one that
wrote the manifest: 150 role comparisons, zero mismatches.

**Limits.** A privilege set matching its manifest proves the migration did what it intended,
not that the intent is correct. The manifest itself is the claim under review.

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

**Limits.** The runtime test uses a **stubbed data layer**. It proves the route's decision
logic, not its behaviour against a real database. The route trace was static.

**Open questions.** Does every service-role query in every route carry a tenant or user
scope, or are there paths that read broadly and filter afterwards? Is there any route that
returns data before completing its membership check?

## Boundary 3 — cross-institution isolation

**Established at the database boundary.** A client role cannot read or write any institution
record at all, so cross-tenant access from a browser is impossible by construction.

**Not established end-to-end.** The route-level guarantee is traced in code, not exercised
against a real database with two institutions. This is the weakest link in the package and
the highest-value thing to test next.

**Open questions.** Given two institutions with real memberships and classes, can a user of
A reach B's records through the actual service-role query path by manipulating a code, an
identifier or a request body? Does an omitted `school_code` fail closed or error?

## Where this evidence is weaker than it may appear

- The runtime route test stubs the data layer.
- Tenant isolation is asserted at the database boundary and traced in code, not exercised
  end-to-end across two institutions.
- 66 of 75 tables grant `authenticated` nothing — correct for a service-role-only model, but
  any unexamined student read path using `authenticated` against them will fail.
- The classifier controls prove the assertions reject misclassification; they do not prove
  the cases exercise every reachable code path.
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

## Required output

An explicit approval or rejection, with conditions if any, stating for each of the three
boundaries whether it is satisfied, unsatisfied, or unverified. "Tests pass" is not a
verdict.

