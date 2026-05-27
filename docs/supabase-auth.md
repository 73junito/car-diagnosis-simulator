# Supabase attempts table and RLS notes

This document records the initial migration for the `attempts` table used
for storing student and ASE workflow attempts in Supabase.

Key points
- Migration file: `db/migrations/002_create_attempts.sql`
- Includes an RLS scaffold policy that references `auth.uid()`; this is
  intentionally a scaffold and should be reviewed before enabling enforcement.
- No client-side auth gating is implemented in this change.
- Indexes are added for `user_id`, `scenario`, and `created_at` to support
  common query patterns.

Deployment notes
- Apply this migration against your Supabase/Postgres instance using your
  preferred migration tool (pgcli, psql, Supabase migrations, etc.).
- Ensure the `pgcrypto` extension is available (or swap `gen_random_uuid()` for
  `uuid_generate_v4()` if using `uuid-ossp`).

Security
- The provided RLS policy is an example allowing users to access their own
  attempts. Adjust policies for instructor roles or system service accounts as
  needed.
# Supabase Auth Configuration

This document explains how the repository integrates with Supabase for token verification and the configuration options available for demo and production modes.

Environment

- `SUPABASE_URL` — your Supabase project URL (no secrets in repo)
- `SUPABASE_ANON_KEY` — the public anon key for the project
- `TORQUEMIND_AUTH_MODE` — `demo` or `supabase` (defaults to `demo`)

Modes

- `demo` (default):
  - Token verification is attempted only if Supabase env vars are present.
  - When no Supabase env vars exist, the system falls back to the header-based demo mode.
  - Useful for local development and demos. Use the `x-torquemind-role` header to simulate roles.

- `supabase`:
  - Strict mode. Presence of an `Authorization: Bearer <token>` header without valid Supabase env vars will deny access (fail-closed).
  - Invalid tokens are denied.
  - Only verified Supabase users are treated as authenticated.

Security notes

- Do NOT commit real `SUPABASE_ANON_KEY` or any secret to the repository.
- Store `SUPABASE_URL` and `SUPABASE_ANON_KEY` securely in your deployment environment (Vercel environment variables or equivalent).

Vercel setup

Add the following environment variables to your project in Vercel:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `TORQUEMIND_AUTH_MODE=suabase` (set to `supabase` for production)

Local testing

- For local testing without Supabase, keep `TORQUEMIND_AUTH_MODE=demo` and use the `x-torquemind-role` header to simulate roles.
- For unit tests, the Supabase client is mocked — no network calls or secrets are required.
