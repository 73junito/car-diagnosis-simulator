# Ollama Tunnel — Staging Integration Checklist

This checklist documents the exact steps to integrate a Cloudflare Tunnel + Cloudflare Access for the staging environment. Follow each step and mark it complete in your release tracking system.

Preconditions
- Do not change the active staging URL in the Worker until step 7.
- Keep PR #332 open and unmerged until verification (step 10) succeeds.
- RALA chunk work remains a separate workstream.

Checklist

1. Install and authenticate `cloudflared` on the target staging host or workstation.
   - Confirm `cloudflared --version` runs and the account is authenticated with Cloudflare.

2. Create a named tunnel for the Ollama host.
   - `cloudflared tunnel create <tunnel-name>`
   - Save the generated tunnel credentials securely.

3. Map the tunnel hostname to the local Ollama HTTP port.
   - Configure the ingress rule so the public hostname (e.g., `ollama.yourdomain.com`) forwards to `http://127.0.0.1:11434`.
   - Start the tunnel and confirm the tunnel process is running under a supervisor (systemd, service, or PM2 as appropriate).

4. Create the Cloudflare Access application for the tunnel hostname.
   - Choose the application type (Service Token) and restrict to the Worker or service identity.

5. Create a Cloudflare Access service token.
   - Record the `client_id` and `client_secret` securely (do not commit to source control).

6. Add `OLLAMA_ACCESS_CLIENT_ID` and `OLLAMA_ACCESS_CLIENT_SECRET` as staging Worker secrets.
   - Use `wrangler secret put` or the Cloudflare dashboard to add both values.

7. Update only the staging `TORQUEMIND_AI_URL` to the real tunnel hostname.
   - Example: `https://ollama.yourdomain.com/api/chat`

8. Build and deploy staging.
   - Run the standard staging build and publish process for the Worker and any server-side components.

9. Verify the tunneled endpoint `/api/health` responds.
   - Request the tunneled host `/api/health` from a trusted test runner.

10. Verify a valid tutor request returns HTTP `200` and the tutor JSON contains all four fields:
    - `reasonIncorrect`
    - `reasonCorrect`
    - `aseConcept`
    - `nextStep`

11. Verify Durable Object rate limiting still functions — after hitting the limit the Worker should return `429`.

12. Confirm logs do not contain prompts, responses, secrets, raw IP addresses, or Access headers.
    - Ensure structured logging is used and sanitize any accidental provider payloads.

13. Document rollback steps to revert staging to the previous deployment.
    - Include the previous staging artifact ID, environment values, and commands to redeploy.

14. Update PR #332’s description with the verified rollout results and evidence (health checks, sample response, log audit). Do not merge PR #332 until step 10 passes.

Notes
- Keep local models and tooling unchanged — apply these rules only to the Worker staging/production path.
- If any verification fails, follow rollback and remediation before proceeding.
