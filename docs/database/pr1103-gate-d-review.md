# PR #1103 — Gate D security evidence (pre-merge)

**Scope:** Read-only database privilege inventory and independent review. PR #1103 stays Draft. This document does not approve the migration, alter credentials, or authorize writes.

## Source and intended authorization contract

Proposed migration: `supabase/migrations/20261022000000_enforce_least_privilege_public_schema.sql`.
Manifest: `docs/database/table-access-policy.json`. It classifies 75 public tables (66 service-role-only, nine with explicit authenticated grants).

| Table | Authenticated privileges to confirm with client tests |
| --- | --- |
| classes | SELECT INSERT UPDATE DELETE |
| enrollments | SELECT INSERT |
| replays | SELECT INSERT |
| completions | SELECT INSERT |
| assignments | SELECT INSERT |
| profiles | SELECT |
| syllabi | SELECT INSERT UPDATE DELETE |
| syllabus_scenarios | SELECT INSERT UPDATE DELETE |
| scenario_catalog | SELECT |

**Critical distinction:** SQL `GRANT` is necessary but not sufficient for client success. Each role-scoped operation also requires the applicable RLS policy and real JWT claims. Service-role calls must not be mistaken for authenticated clients.

## Evidence collection — not yet executed against staging

Script: `scripts/sql/gate-d-security-inventory.sql`. Run only on the verified *staging* project using existing governed read-only access, `verify-full` TLS, target assertions, a 20-second statement timeout, and an explicit `BEGIN READ ONLY`. Review output before retention or sharing. No production run is authorized.

The query inventories table ACLs and owners; RLS flags; default ACLs for all relevant creator roles; sequence usage privileges; and routine execution grants and `SECURITY DEFINER` flags. It does not expose table rows, question content, JWTs, secrets, or user data.

**Outstanding:** staging current grants, database role, object-owner/default-ACL provenance, unlisted/column-level grants, sequence/routine impact analysis, and any differing production state. Do not assert parity before these are collected and reviewed.

## Disposable compatibility matrix — design and sign-off checklist

Use a data-equivalent *disposable clone only after the approved restore/clone gate*, or a synthetic database for preliminary tests. All test writes must be confined to the disposable instance. In each row test both a permitted and forbidden operation, using `SET ROLE authenticated`/`anon` and realistic `auth.uid()` claims when RLS relies on them. Record command, expected result, observed result, RLS policy, and any dependent function or sequence grants.

- Classes: authorized classroom CRUD; unauthorized cross-institution CRUD.
- Enrollments: own enrollment reads/inserts; cross-user reads/inserts; verify whether UPDATE/DELETE are required by actual flows.
- Replays/completions/assignments: create/read allowed records; cross-user attempts; check any update or deletion feature.
- Profiles: own profile SELECT versus another learner's profile.
- Syllabi/syllabus_scenarios: authorized instructor CRUD versus unrelated institution access.
- Scenario catalog: approved browsing vs non-public content, particularly view/function inheritance.
- Anonymous: all nine table operations denied unless a separately approved exception exists.
- Verify `TRUNCATE`, `REFERENCES`, and `TRIGGER` remain unavailable to client roles.

**Do not assume** `SET ROLE` alone reproduces a full authenticated Supabase request: claims and roles must match actual app session behavior.

## Additional boundaries

- Review `pg_default_acl` for creator roles `postgres`, `supabase_admin`, and any other role that creates application tables. The migration modifies only the executing role's default privileges.
- Audit public views for `security_invoker`, view ownership, and exposure through Data API.
- Inventory sequences (`USAGE`), routines (`EXECUTE`), function `SECURITY DEFINER` and search paths independently; the current manifest only covers table grants.
- Confirm six owner-decision service-only classifications against current application consumers and any dynamic SQL.
- Do not add `FORCE ROW LEVEL SECURITY`, revoke sequence/function rights, repair migration history, or apply the corrective migration as part of this review.
- PR #1105's hosted image-provenance failure is separate; no relaxation of container isolation is permitted.

## Release gates (all required)

- [ ] Governed staging read-only inventory completed, captured, compared to manifest
- [ ] Restorable staging backup verified before clone or any staging write
- [ ] Disposable compatibility tests pass, including negative tenant-boundary controls
- [ ] Existing app and RLS consumers checked; differences documented and resolved
- [ ] Sequence, routine, view, default-ACL, and object-owner impact analysis completed
- [ ] Independent qualified database-security reviewer signs named evidence
- [ ] Hosted migration validator executes completely without bypasses
- [ ] PR review and merge permissions separately authorized

## Synthetic PostgreSQL 17 validation (2026-10-23)

A brand-new container `gate-d-synthetic-20261023` ran with `--network none`, using only synthetic objects. Fixture: `scripts/sql/gate-d-synthetic-fixture.sql`. SQL inventory executed with `psql -X -v ON_ERROR_STOP=1`, exit 0. Evidence categories returned: target, table ACL, column ACL, default ACL, sequence ACL, routine ACL, view security. The target reported `transaction_read_only=on`; execution concluded with `ROLLBACK`.

Negative/positive controls: authenticated table SELECT=true; anon table SELECT=false; anon column SELECT=true; authenticated sequence USAGE=true. SECURITY DEFINER and security_invoker were correctly reported. These fixture controls intentionally exhibit a risky column-level anonymous grant so that an inventory can detect it. The container was explicitly removed after verification; pre-existing Docker containers were untouched.

**Limit:** these are metadata and privilege-observation fixtures, not end-to-end application/JWT/RLS compatibility tests. No staging/prod comparison or independent approval has occurred.

**Current result: PostgreSQL inventory execution verified; Gate D remains HOLD pending application compatibility and independent approval.**
