# LMF writer key rotation and retention validation

The server-side reference evidence store now accepts `signingKeys` and `activeKeyId`, using the versioned HMAC keyring when writing events. The existing single-key `key` parameter remains a legacy compatibility path and is assigned identifier `legacy-v1`. The key identifier is stored in the signed evidence record (`signingKeyId`) inside the event payload, so a reader with the retained verification key can verify historical events without weakening chain binding.

`tests/lmf-writer-rotation.test.js` exercises two sequential writes with different active signing keys and verifies both signatures and their hash chain. This is a mocked query-provider test, not a PostgreSQL persistence test for rotated keys.

`tests/lmf-retention-behavior.sql` was successfully executed with all three draft LMF migrations in a local PostgreSQL rollback-only transaction, verifying expiration deletion, event cascading, protection of nonexpired sessions, and repeated empty cleanup. Retention scheduling remains disabled, and policy approval and live operational testing remain required before deployment.
