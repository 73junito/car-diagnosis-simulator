# Trusted LMF reference evidence service composition

`createReferenceEvidenceService` assembles the reviewed model digest validator, Supabase Auth `getUser` token verifier, trusted computation callback, private PostgreSQL evidence store and guarded request handler. It verifies the engineering template at initialization and immediately before each computation, compares the computed record's model provenance, and never accepts caller-supplied measurements.

**Deployment boundary:** This is a server-only dependency-injection bootstrap, not a mounted API. Test providers verify the composition contract; a live authenticated user-to-PostgreSQL end-to-end transaction is not yet verified. Production setup must inject a trusted server-side solver computation implementation, the correct signed-in Supabase Auth client, privileged database credentials from server-only secrets, strict request size/time limits and HMAC signing key. No demo authentication fallback, public API exposure, grading authorization or database deployment is enabled by this commit.

Outstanding gates: live auth and PostgreSQL integration, authenticated ownership denial cases, signing-key rotation, retention cleanup and reviewer approval.
