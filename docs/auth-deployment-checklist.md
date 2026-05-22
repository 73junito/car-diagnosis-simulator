# Supabase Auth Deployment Checklist

Purpose
-------
This checklist documents the runtime verification and deployment steps required to safely enable Supabase-backed authentication for telemetry/live-session access. It provides deterministic smoke-test commands, expected behaviors, failure-mode guidance, and a rollback procedure to avoid relying on tribal knowledge.

Required Environment Variables (Vercel / production)
--------------------------------------------------
- `TORQUEMIND_AUTH_MODE` — Set to `supabase` in production (enforces strict verification).
- `SUPABASE_URL` — Your Supabase project URL (e.g. `https://<project>.supabase.co`).
- `SUPABASE_ANON_KEY` — The Supabase public anon key (do NOT commit this to the repo).

Local Smoke Tests
-----------------
Run these locally on an up-to-date `main` branch before and after deployment.

Demo-mode (header fallback):

```powershell
$env:TORQUEMIND_AUTH_MODE = "demo"
node tests/supabase-auth-config.test.js
node tests/supabase-route.test.js
# Note: repository does not include a `live-session-route` local test; see Known Gaps.
```

Strict Supabase mode (fail-closed if envs missing):

```powershell
$env:TORQUEMIND_AUTH_MODE = "supabase"
Remove-Item Env:\SUPABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:\SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
node tests/supabase-auth-config.test.js
```

Expected Results
----------------
- Demo mode (`TORQUEMIND_AUTH_MODE=demo`):
  - Header fallback allowed: requests with `x-torquemind-role: instructor` should be granted instructor access in local/demo environments.
  - Supabase verification is attempted only if env vars exist.
- Supabase mode (`TORQUEMIND_AUTH_MODE=supabase`):
  - If `Authorization: Bearer <token>` is present and no Supabase env vars are configured — auth initialization must fail closed and requests should be denied.
  - Invalid tokens should be denied.
  - Verified instructor tokens should be allowed.

Failure Modes
-------------
- Missing or misconfigured `SUPABASE_URL`/`SUPABASE_ANON_KEY` in `supabase` mode: denies access (expected fail-closed).
- Invalid token format or expired token: denied with audit event recorded.
- Supabase service outage: in `supabase` mode, verification errors are treated as denial; plan for operational alerts and rollback.

Rollback Instructions
---------------------
If production users are blocked after enabling `supabase` mode:

1. In the deployment environment (Vercel), set `TORQUEMIND_AUTH_MODE=demo` to re-enable header fallback for emergency access.
2. Investigate Supabase env values and token verification logs.
3. Revert to previous stable deployment if necessary.

Important: Only use `TORQUEMIND_AUTH_MODE=demo` for development, staging, or emergency recovery — never as a permanent production setting.

Production Deployment Validation
--------------------------------
1. Add the required env vars in Vercel Project Settings → Environment Variables:
   - `TORQUEMIND_AUTH_MODE=supabase`
   - `SUPABASE_URL` (set to your Supabase project URL)
   - `SUPABASE_ANON_KEY` (set to your anon key)
2. Deploy to a staging environment and run the local smoke tests against staging endpoints if possible.
3. Verify audit events for access attempts appear in telemetry and include `source: "supabase"` and `allowed` flags.

Known Gaps / Follow-ups
-----------------------
- There is no `tests/live-session-route.test.js` or `npm run test:live-session-route` script in the repo — update CI/docs if a local script is required by future workflows.
- Consider adding an automated staging check that calls the live-session endpoint with a known test token to verify the end-to-end flow.

Notes
-----
- Do NOT commit secrets into the repository. Use Vercel environment variables or a secret manager.
- This checklist is intentionally conservative: in `supabase` mode we fail closed to prevent accidental exposure of instructor-only features.
