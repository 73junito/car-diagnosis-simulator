# LMF protected evidence HTTP handler (draft)

`src/lmf-runtime/reference-evidence-handler.js` provides a dependency-injected POST-only transport handler. It requires a bearer token, accepts only `sessionId` and a constrained model request, rejects caller-supplied measurements, returns no-store responses, and maps expected auth, ownership and chain-conflict failures to HTTP status codes. It never enables demo identity fallbacks.

This component **is not mounted as a production `/api` route**. Activation still requires a server-only bootstrap that connects a trusted Supabase Auth `getUser(token)` client, a privileged PostgreSQL connection to the private atomic append function, a pinned-model-verified simulation evidence computation callback, and a server-only HMAC key. Do not mount before deployment-safe credentials, request limits, multi-user integration tests, retention, rotation and security review are complete. Assessed or published results must remain independently gated.
