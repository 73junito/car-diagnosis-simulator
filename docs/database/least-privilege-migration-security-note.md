# Least-privilege migration — security review note

Migration: `supabase/migrations/20261022000000_enforce_least_privilege_public_schema.sql`
Status: **validated in a disposable Supabase PostgreSQL 17 instance; not applied to staging or production.**
This note supports an independent security review. The migration file is unchanged by the hardening pass that produced this note.

## 1. Schema-wide revocation (lines 34 and 41)

```sql
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
```

- `anon` is revoked everywhere. No canonical migration grants `anon` a table privilege, and consumer tracing found no anonymous table reader; access is mediated by the Worker and edge functions using the service role. Verified after the migration: `anon_tables_with_grants = 0`.
- `authenticated` is revoked everywhere **and then re-granted explicitly** at lines 43–51, so the net effect is a rebuild, not a removal. Verified: exactly 9 tables carry grants, matching the canonical chain.
- **Review point:** a schema-wide `REVOKE ALL` also removes any grant that a *future* migration makes to a table created **before** this migration but granted **after** it — only if that grant is later revoked. The statement is one-shot, so its effect on later grants is nil; the durable behaviour change is the `ALTER DEFAULT PRIVILEGES` below.

## 2. Preservation of the nine authenticated grants (lines 43–51)

| Table | Granted | Authority |
| --- | --- | --- |
| `classes` | SELECT, INSERT, UPDATE, DELETE | `20260924052734_restore_classroom_api_schema.sql:85` |
| `enrollments` | SELECT, INSERT | `:86` |
| `replays` | SELECT, INSERT | `:87` |
| `completions` | SELECT, INSERT | `:88` |
| `assignments` | SELECT, INSERT | `:89` |
| `profiles` | SELECT | `20260918203224_profiles.sql` |
| `syllabi` | SELECT, INSERT, UPDATE, DELETE | `20260823041129_harden_syllabus_table_privileges.sql:15` |
| `syllabus_scenarios` | SELECT, INSERT, UPDATE, DELETE | `:15` |
| `scenario_catalog` | SELECT | `:23` |

Every grant reproduces a canonical statement; none is invented. Course enrolment, instruction, assignment, assessment and completion operations keep the operations the chain granted them. **Review point:** the five classroom tables lost `UPDATE`/`DELETE` (four of them) and every table lost `TRUNCATE`/`REFERENCES`/`TRIGGER`. Those came from Supabase default privileges, not from any migration. If a governed feature needs `UPDATE` or `DELETE` on `enrollments`, `replays`, `completions` or `assignments`, that must be added as a new canonical grant.

## 3. Default-privilege change (single statement, current role only)

```sql
alter default privileges in schema public revoke all on tables from anon, authenticated;
```

**Why it is not `FOR ROLE supabase_admin`.** PostgreSQL permits changing your own
default privileges and those of roles you are a member of. Measured in a
disposable Supabase PostgreSQL 17 instance:

| Role | superuser | member of `supabase_admin` |
| --- | --- | --- |
| `supabase_admin` | **yes** | — |
| `postgres` | **no** | **no** — it is a member of `anon`, `authenticated`, `service_role`, `supabase_privileged_role`, … |

`postgres` therefore cannot alter `supabase_admin`'s defaults, and the earlier
`FOR ROLE supabase_admin` statement failed on the platform with
`SQLSTATE 42501 permission denied to change default privileges`. The implicit
current-role form needs no cross-role membership and applies to whichever role
actually runs migrations.

**Verified scope of the broad grants** (`pg_default_acl`):

```
postgres       schema=public  type=r  {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, …}
supabase_admin schema=public  type=r  {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, …}
```

Both are **per-schema** entries; there are no global entries, so a per-schema
`REVOKE` is effective here. (PostgreSQL documentation: per-schema default
privileges can only *add* to the global setting, so a per-schema `REVOKE` would
be a no-op against a *global* grant. That is not the case for these roles.)

**Platform-managed residual — cannot be closed by this migration.**
`supabase_admin` also holds per-schema `public` defaults granting
`anon`/`authenticated` the full set. A project migration is neither a member of
that role nor a superuser, so it cannot change them, and it must not try. They
take effect only for objects created **by `supabase_admin`**; the platform uses
that role for administration and extensions, not for application tables, so the
practical exposure is limited. **This is a boundary, not a fix** — it is recorded
here rather than claimed as resolved.

**What this migration therefore enforces:** the defaults of the role that runs
migrations no longer grant client privileges, and every existing `public` table
carries only the reviewed client privileges. **What it does not enforce:**
`supabase_admin`'s own default ACL.

## 4. Impact on future migrations

- New tables arrive with **no** `anon`/`authenticated` privilege, so `docs/database/table-access-policy.json` must be extended in the same change that grants access, or the live audit will report `UNCLASSIFIED_OBJECT`.
- `scripts/verify-table-access-policy-manifest.js` fails on a dynamic `GRANT` naming a client role, because such a grant cannot be represented in the manifest. Dynamic `REVOKE`s are recorded as informational: they can only reduce access, and any resulting shortfall is caught by the live audit.

## 5. Remaining sequence and function privileges (not remediated)

Measured after the migration: **8 sequence `USAGE` grants** (`anon` and `authenticated`) and **4 routine `EXECUTE` grants**. The manifest and the audit cover **tables only**.

- The sequences are not created by any canonical migration (no `create sequence`, no `serial`/`bigserial` columns), so they originate from the platform image and could not be named from repository evidence.
- 17 functions exist in `public` from canonical migrations; only 2 retain client grants, and the objects were not enumerable from repository evidence.
- **Required next step:** a separate, read-only enumeration and impact analysis. These must **not** be revoked blindly, and must **not** be treated as secure by omission.

## 6. Explicit non-claims

- Staging and production privilege state is **unknown**; no live database was contacted.
- The disposable validation does not establish that production carries the same default-ACL grants.
- No privilege was changed outside a disposable container.
