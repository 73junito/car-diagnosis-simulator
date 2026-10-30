# LMF key rotation and retention draft

The server-only `createEvidenceKeyring` signs new evidence with a named active key ID and can verify historical evidence while earlier key versions remain available. Keys must be injected from server-only secret management; retiring a key makes old events unverifiable unless separately archived securely. **The current live adapter still calls `signEnvelope` directly; the keyring is not yet wired into that path.** No key material is committed.

The private `lmf_private.purge_expired_reference_sessions` function deletes bounded batches of expired sessions (events cascade), using row locking with SKIP LOCKED. Execution is restricted to `service_role`; it is not scheduled, and no retention duration has been approved. Do not deploy or invoke until approved retention policy, server-role job credentials, audit logging, backup/privacy rules, and independent integration tests are complete.
