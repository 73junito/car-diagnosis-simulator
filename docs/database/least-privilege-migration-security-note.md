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

## 5. Remaining sequence and function privileges (enumerated, not remediated)

Measured after the migration: **8 sequence `USAGE` grants** (`anon` and `authenticated`) and
**4 routine `EXECUTE` grants**. The manifest and the audit cover **tables only**.

The objects are now **named**, by a read-only enumeration added to the disposable validator
(`scripts/validate-migrations-disposable.js`, phase `residual-enumeration`). It applies the
same canonical chain in the digest-pinned container and then selects the client ACLs for
sequences and routines. It grants nothing, revokes nothing, and does not affect the
validation verdict.

| Object | Kind | Client grants | Created by |
| --- | --- | --- | --- |
| `public.battery_temperature_telemetry_id_seq` | sequence | `anon`, `authenticated` — USAGE | `20260823233137_create_staging_vehicle_reference_datasets.sql:78` — identity column |
| `public.diagnostic_data_domains_id_seq` | sequence | `anon`, `authenticated` — USAGE | `20260710204828_external_data_resource_registry.sql:507` — identity column |
| `public.diagnostic_execution_events_id_seq` | sequence | `anon`, `authenticated` — USAGE | `20261013005905_add_diagnostic_copilot_stage2.sql:59` — identity column |
| `public.external_data_resources_id_seq` | sequence | `anon`, `authenticated` — USAGE | `20260710204828_external_data_resource_registry.sql:6` — identity column |
| `public.enforce_evidence_source_gate_consistency()` | routine | `anon`, `authenticated` — EXECUTE | `20260926000000_enforce_evidence_approval_gates.sql:200` — trigger function |
| `public.enforce_source_chunk_evidence_gate()` | routine | `anon`, `authenticated` — EXECUTE | `20260926000000_enforce_evidence_approval_gates.sql:95` — trigger function |

**Correction to an earlier inference in this note.** This note previously said the sequences
"are not created by any canonical migration (no `create sequence`, no `serial`/`bigserial`
columns), so they originate from the platform image". That inference was wrong. The literal
`create sequence` statement is absent because `GENERATED ... AS IDENTITY` creates the
sequence implicitly, and all four sequences belong to tables created by canonical
migrations, as the table above shows.

**Where the grants come from.** No canonical migration grants `anon` or `authenticated`
anything on these six objects. They are the platform's broad per-schema `public` default
privileges described in section 3, inherited by objects created before this migration
tightened the *table* defaults; the schema-wide `REVOKE ALL` in section 1 covers tables
only, so sequences and routines keep the platform defaults. `service_role` holds its own
explicit grants and is unaffected.

**Why exactly these two routines.** The canonical chain *does* revoke function execution
from `public`, `anon` and `authenticated` — for example
`20261012031851_harden_trigger_function_execution.sql` revokes it on
`handle_new_auth_user()`, `capture_student_institution_claim()` and
`set_external_data_resource_updated_at()`. The two evidence-gate trigger functions were
created earlier, in `20260926000000_enforce_evidence_approval_gates.sql`, and were not in
that revoke list, so they are the residual the enumeration reports. No `revoke` on a
sequence appears anywhere in the chain, which is why all four sequences retain the
platform defaults.

**What this does and does not establish.** The residual is enumerable and attributable, so
it is no longer "not enumerable from repository evidence". It is still **not remediated**:
the manifest and the audit cover tables only, so these grants sit outside the reviewed
privilege set. Closing it needs a separate impact analysis — the two routines are trigger
functions and the four sequences back identity columns — and a follow-up migration that
extends the revokes to the two missed functions and the four sequences, with the manifest
extended to match. That is a follow-up change and must not be done by omission or by a
blind revoke.

## 6. Explicit non-claims

- Staging and production privilege state is **unknown**; no live database was contacted.
- The disposable validation does not establish that production carries the same default-ACL grants.
- No privilege was changed outside a disposable container.
