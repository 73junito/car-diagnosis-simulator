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
