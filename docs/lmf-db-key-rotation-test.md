# Database-backed LMF signing-key rotation verification

`tests/lmf-db-key-rotation.cjs` verifies the actual reference evidence writer against a disposable PostgreSQL database named `lmf_rotation_verify`, provisioned with the two initial draft LMF migrations and a minimal local-only `auth.users` table. Supply the local-only `LMF_TEST_DATABASE_URL` plus a Node module path that resolves `pg`; the test rejects other database names.

It writes one signed event with key version `v1`, rotates the active writer to `v2`, then writes a second event. It reads both persisted `jsonb` payloads, verifies the sequence numbers, previous hash linkage, and both HMAC signatures using the retained keyring. It also checks that verification fails when the historical key has been retired. Keys are generated ephemerally and never committed.

Test passed locally on October 24, 2026. The disposable database was subsequently deleted. This is not a production deployment, a key-rotation scheduler, or an audit of key storage policies.
