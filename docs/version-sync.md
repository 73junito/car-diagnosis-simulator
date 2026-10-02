# Version Sync (free-tier)

This project uses a lightweight deployment versioning strategy to avoid clients running stale JS bundles after deploys.

How it works

- A `public/version.json` file is generated at build time by `scripts/write-version.js`.
- The client loads `/version.json` and compares it to the current version (stored in `localStorage` and `window.APP_VERSION`).
- If a mismatch is detected, a small banner is shown and the page is auto-reloaded (debounced across tabs).

Build integration

Add the following `build` step (already present):

```
node scripts/write-version.js && echo "no build step required for static site"
```

CI note

- On GitHub Actions, `GITHUB_SHA` is used automatically. On Cloudflare Workers Builds, `WORKERS_CI_COMMIT_SHA` is used. `GIT_COMMIT` and `APP_VERSION` remain supported fallbacks; if none are present, the version is `dev`.
- Do NOT commit `public/version.json` changes back to the repo — the file is intended to be generated during the build.

Client wiring

The client loader is `dashboard/version-sync.js`. Pages that include the dashboard loader should call `startVersionSync()` during page init.

API compatibility

For extra safety, consider returning `x-app-version` in API responses or HTTP 409 for schema mismatches. The client will reload when it sees a 409 or a differing `x-app-version` header.
