# Scheduled Harness — Usage & Configuration

This document explains how to run and operate the scheduled harness and related CI workflows that produce run artifacts and grow `runs/history.csv`.

Required secrets
- `HARNESS_URL` (required): the public URL of the deployed app (used by the scheduled harness to send requests). Add in GitHub repository Settings → Secrets.
- `VERCEL_TOKEN` (optional): Used to fetch Vercel deployment logs for richer artifact generation. If omitted, log-derived artifacts will be skipped.

Workflows
- `.github/workflows/scheduled-harness.yml`: runs daily (or on-demand via `workflow_dispatch`) and:
  - runs `scripts/harness.js` to generate a scheduled run export under `runs/run-scheduled-latest.json`
  - optionally fetches Vercel logs (requires `VERCEL_TOKEN`) and produces `runs/digest-scheduled.json`, CSVs, and plot-ready JSONs
  - commits `runs/` artifacts and uploads them as an Actions artifact bundle named `runs-artifacts`
- `.github/workflows/append-runs-history.yml`: scans `runs/dashboard-*.csv`, extracts the run row(s), deduplicates by `generatedAt`, appends unique rows to `runs/history.csv`, and uploads artifacts. This preserves a historical ledger of limiter health.

Where artifacts appear
- In the repository under `runs/` (e.g. `runs/dashboard-*.csv`, `runs/plot-ready-*.json`, `runs/combined-requests-*.csv`, `runs/digest-*.json`, `runs/vercel-raw-*.txt`).
- As an Actions artifact bundle named `runs-artifacts` attached to the scheduled run in the Actions UI.

How history grows
- Each scheduled run emits a small `dashboard-*.csv` (header + single summary row). The `append-runs-history` workflow collects these CSVs, extracts the summary rows, deduplicates by `generatedAt` and appends unique rows to `runs/history.csv` in the repo — producing a time-series ledger you can plot or analyze.

Manually trigger a run
- From the GitHub UI: Actions → choose **Scheduled Harness Run** → *Run workflow*.
- From the command line (GitHub CLI):
  gh workflow run scheduled-harness.yml

Local ad-hoc run
- You can run the harness locally against a deployment or a local server (helpful for debugging):

```bash
npm ci
# example (adjust flags as needed):
node scripts/harness.js --count 50 --concurrency 3 --rate 10 --export runs/run-local.json --url "https://your-deployment.example"
```

Notes & troubleshooting
- Ensure `HARNESS_URL` points to the deployment you want to probe (production or staging). The scheduled harness will otherwise fail to send requests.
- If `VERCEL_TOKEN` is not present, the workflow will still commit run exports and upload artifacts, but log-derived CSVs/digests will be skipped.
- To reduce noise, the harness and pipeline honor `X-HARNESS-BYPASS` and `RATE_LIMIT_MODE` behavior configured by the service.

If you'd like, I can add a short README section to the repo `README.md` linking to this file. Want that now? 
