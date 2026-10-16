# GitHub Actions Secrets — Checklist

This file lists repository secrets used by CI workflows related to the scheduled harness and limiter observability pipeline.

Required secrets
- `HARNESS_URL` — The public URL used by the harness to send requests (example: a Cloudflare deployment URL). The scheduled workflow will fail silently or produce empty logs if this is missing.

Optional secrets
- `ADMIN_TOKEN` — (Optional) Used by admin-protected API endpoints for status checks or admin-only operations.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Only needed if your deployment uses Supabase for persistence; store these if CI or local runs require Supabase access.

How to add a secret
1. Go to your repository on GitHub → Settings → Secrets and variables → Actions → New repository secret.
2. Enter the secret name (exactly as above) and paste the value.
3. Save.

How to verify secrets are working
- Trigger the scheduled harness manually: Actions → **Scheduled Harness Run** → *Run workflow* (choose a branch).
- In the run logs, confirm the `Run harness` step completes and that `runs/run-scheduled-latest.json` is produced.
- Check the Actions artifact named `runs-artifacts` for the expected files (dashboard, digests, CSVs).

Troubleshooting
- If the harness produces no run export, verify `HARNESS_URL` points to a reachable deployment and is set in repository secrets.
- For admin endpoints returning 401, ensure `ADMIN_TOKEN` is configured in the target deployment environment.

Want me to add an automated check that fails the workflow when `HARNESS_URL` is missing? I can add that as a follow-up.
