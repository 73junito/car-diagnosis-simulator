# LMF Supabase Auth identity boundary

`src/lmf-runtime/supabase-auth.js` provides `createSupabaseTokenVerifier(authClient)` using `auth.getUser(token)` to validate a supplied access token with Supabase Auth. It refuses invalid or anonymous users and returns the verified user ID to the existing evidence store's `verifyAccessToken` dependency. Do not substitute `getSession`, unverified JWT decoding, user metadata, or a caller-provided UUID for this validation.

This is a server-only integration adapter and unit-tested contract, **not a deployed API endpoint**. The caller must instantiate a properly scoped Supabase Auth client, authenticate all operations, compute evidence using the digest-verified project model, keep signing keys server-side, and enforce transaction/retention controls. No production or staging deployment has occurred.
