# LMF evidence security integration gates

This draft includes a server-only model digest verifier and HMAC-SHA256 evidence envelope; the proposed Supabase migration enables RLS and owner-scoped SELECT while preventing direct browser writes. These components are **not deployed or connected to authentication**.

Security-critical integration requirements before use:

1. Authenticate each request on the server using trusted Supabase Auth JWT verification (`getUser` or equivalent validated claims); derive `owner_id` from the authenticated principal **never** from the submitted evidence payload. UUID syntax validation is not authentication.
2. Verify the loaded model using `verifyModel` before each signed solve/replay; enforce immutable approved model identifiers and pinned digest, and reject unsupported fault/model behavior.
3. Store HMAC keys in server-only secrets, rotate and version keys, use fresh per-session IDs, and deny replay after session expiry. A valid HMAC proves signing-key possession, not accuracy of the simulation.
4. In one transaction, lock the session row, check actor ownership and expiration, enforce sequence continuity, and append a signed event. An isolated application-side hash is not sufficient to guarantee append-only semantics or prevent replay races.
5. Verify chained hashes/signatures on reads, and purge expired records using an authorized retention job. Establish policy-approved retention/deletion windows and monitor unsuccessful verifications.
6. Test RLS with two distinct authenticated users, anon, and service role against an isolated Supabase PostgreSQL database before applying the migration. Record advisor results and all CI checks.
7. Formal assessments and publication remain governed by independent approvals. This schema is practice/reference evidence only.

**Do not merge/apply this migration or expose write APIs before the auth boundary, transactional append mechanism, full DB integration testing, and retention process are implemented.**
