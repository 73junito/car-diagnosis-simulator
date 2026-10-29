# R22 — PGlite RLS harness

Verification harness for PostgreSQL row-level security. It runs the repository's
**real** migrations and policies against a real PostgreSQL engine (PGlite — PostgreSQL
compiled to WASM) with no Docker, no credentials, and no host permission changes.

Status: **evidence only.** Passing this suite does not certify R22 against
production-equivalent Supabase infrastructure. See
`docs/security/R22-PGLITE-RLS-EVIDENCE.md`.

## Run

`@electric-sql/pglite` is a pinned devDependency (`0.5.13`, Apache-2.0), so a clean
install reproduces this harness exactly — no out-of-tree setup required:

```bash
npm ci                      # or: npm install
npm run test:r22            # 32 RLS assertions (incl. privilege audit)
npm run test:r22:matrix     # migration compatibility sweep (reporting only)
```

Direct invocation with evidence output:

```bash
node tests/r22/pglite-rls-harness.mjs --json /tmp/r22-evidence.json
node tests/r22/pglite-rls-harness.mjs --matrix --json /tmp/r22-matrix.json
```

Offline fallback: the harness prefers the repository copy of PGlite, and falls back to
`/tmp/r22-deps/node_modules` if the dependency cannot be installed (recipe in the evidence
document). The fallback exists so the harness remains runnable before/without `npm ci`.

Exit codes: `0` all assertions passed · `1` an assertion failed · `2` harness error ·
`3` a required migration did not apply.

## What is under test

| Layer | Source |
| --- | --- |
| Policies | `supabase/migrations/20260821040000_create_syllabus_and_scenario_catalog.sql` |
| Privileges | `supabase/migrations/20260817012628_create_attempts.sql` (explicit `REVOKE`/`GRANT`) |
| Roles | `anon`, `authenticated`, `service_role` (shimmed, `service_role` has `BYPASSRLS`) |

## Shimmed, because Supabase provides it and PGlite does not

- roles `anon`, `authenticated`, `service_role`
- schema `auth`, table `auth.users` (42 migrations declare FKs to it)
- `auth.uid()` = `(request.jwt.claims ->> 'sub')::uuid`
- `auth.jwt()` = `request.jwt.claims::jsonb`
- Supabase's default table grants for `anon`, `authenticated`, **and** `service_role`

The default-grant shim is load-bearing: without it the `syllabi` policies are never
reached, and statements fail with `permission denied` instead of being filtered by RLS
— a false pass. The harness caught this itself: the first run granted only to `anon`
and `authenticated`, and `service_role` was refused on `syllabi`.

## Not modelled

PostgREST, GoTrue, connection pooling, concurrent sessions, statement timeouts,
extension parity (`pgcrypto` is unavailable), `supabase_migrations` schema. PGlite is
PostgreSQL 18.6; a Supabase project may run a different major version.
