# Scheduled Harness — Usage & Configuration

The scheduled harness validates the current production Cloudflare application without mutating application data and records successful run history through pull requests.

## Scheduled target

The scheduled workflow probes:

- origin: `https://app.autolearnpro.com`
- method: `GET`
- path: `/api/curriculum`
- required success rate: `1.00`

The production origin is intentionally declared in the workflow instead of a repository secret so a stale deployment URL cannot silently redirect the harness to a retired runtime.

## Workflow

`.github/workflows/scheduled-harness.yml` runs daily or through `workflow_dispatch` and:

1. runs `scripts/harness.js`
2. writes `runs/run-scheduled-latest.json`
3. fails closed if the configured success-rate threshold is not met
4. uploads the run export and summary as the `runs-artifacts` Actions artifact
5. appends a row to `runs/history.csv` only after a successful harness run
6. opens a pull request for the history update

The workflow never pushes directly to protected `main`.

Only `runs/history.csv` is versioned. Other files under `runs/` remain generated artifacts.

## Repository setting

GitHub Actions must be allowed to create pull requests for the repository. The workflow itself requests only the permissions it needs:

- `contents: write`
- `pull-requests: write`

## Manual run

From GitHub:

Actions → **Scheduled Harness Run** → **Run workflow**

From GitHub CLI:

```bash
gh workflow run scheduled-harness.yml
```

## Local ad-hoc run

The harness defaults to the current non-mutating curriculum endpoint:

```bash
npm ci
node scripts/harness.js \
  --count 50 \
  --concurrency 3 \
  --rate 10 \
  --min-success-rate 1 \
  --export runs/run-local.json \
  --url "https://app.autolearnpro.com"
```

You can override the request path or method when testing another endpoint:

```bash
node scripts/harness.js \
  --url "http://localhost:8787" \
  --method GET \
  --path /api/curriculum
```

For an intentional mutating endpoint, pass both `--method` and `--path` explicitly.

## Failure behavior

The harness always writes its export before applying the success-rate gate. This preserves evidence for troubleshooting. A run below `--min-success-rate` exits nonzero and does not append to `runs/history.csv`.

A zero-success run is never recorded as healthy history.
