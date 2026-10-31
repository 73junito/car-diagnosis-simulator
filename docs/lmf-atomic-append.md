# Draft atomic evidence append boundary

The `lmf_private.append_reference_event` function locks the owning session row and checks expiration, expected sequence and previous hash before writing in one PostgreSQL transaction. It is SECURITY INVOKER, lives in an unexposed private schema, and grants EXECUTE only to `service_role`.

`src/lmf-runtime/evidence-store.js` is a server-only integration adapter. It requires caller-supplied trusted provider implementations: `verifyAccessToken` must validate a Supabase Auth JWT against trusted identity information, and `computeEvidence` must create results server-side from an approved verified model. It never accepts a client-supplied measurement outcome. It prepares an HMAC-signed envelope and calls the private append function using parameterized queries. Simultaneous append attempts with the same expected head fail closed; retry must redo the authenticated head lookup and recompute a new signed envelope.

The SQL migration was compiled against the **local** PostgreSQL instance inside a rolled-back transaction. Node mock tests verify the integration contract, but real multi-user RLS, concurrent transactions, retention cleanup, signature-key rotation and authentication end-to-end tests are not complete. Neither migration has been applied to staging or production. Do not expose the adapter or merge until these gates pass.
