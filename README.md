# TorqueMind — Diagnostic Training Platform

TorqueMind is a lightweight browser-based training platform for automotive diagnostic reasoning. It provides evidence-driven scenarios, system isolation workflows, and teacher analytics to help trainees build reliable troubleshooting skills.
TorqueMind is a lightweight browser-based training platform for automotive diagnostic reasoning. It provides evidence-driven scenarios, system isolation workflows, and teacher analytics to help trainees build reliable troubleshooting skills.

Overview
TorqueMind helps technicians and instructors practice evidence-based diagnostic reasoning using realistic vehicle scenarios. Students collect evidence, isolate systems, and make confidence-weighted diagnoses while instructors get aggregated insights.

Features
- Scenario-based diagnostic exercises with simulated tools
- System isolation and evidence tracking for structured reasoning
- Confidence-weighted decisions and instant feedback
- Teacher dashboard with exports, insights, and scenario assignment

Demo
Visit the live demo: https://car-diagnosis-simulator.vercel.app/

[![Test Dashboard](https://img.shields.io/badge/test-dashboard-live-brightgreen)](https://73junito.github.io/car-diagnosis-simulator/dashboard.html)

Run locally
```bash
cd "d:/Car Diagnosis Simulator/car-diagnosis-sim"
python -m http.server 8000
# open http://localhost:8000 in your browser
```

Development notes
- The app is a single-page static site (HTML/CSS/JS). No build step required.
- Diagnostic logic lives in `engine/diagnosticEngine.js` and is loaded before `script.js`.
- Backend/Auth powered by Supabase. Firebase removed from the project as of 2026-05-04.

Who it's for
- Technical instructors, vocational trainers, and learners preparing for ASE-style assessments.

Contributing
- Open a PR against `main` or create feature branches. This repo favors small, focused commits.

Contribution and Branch Protection

The `main` branch is protected. All changes must go through a pull request and pass these required PR checks:

- `Unit Tests / unit-tests`
- `API Smoke Test / smoke`
- `db-ssl-validation`

Branch protection currently requires `db-ssl-validation` to pass on pull requests.

One approving review is required, branches must be up to date, and force-pushes/deletions are blocked.

License
- MIT

Security notes
- Enable GitHub Secret Scanning and Push Protection to prevent accidental commits of secrets (API keys, tokens, service credentials). This must be enabled in the repository Security settings by an administrator.
- We recommend enabling Dependency Review and Dependabot alerts for automated dependency vulnerability detection.

## Analytics Exports

Generate instructor analytics artifacts:

```bash
npm run export:analytics
```

Outputs:

- `reports/student-performance.csv`
- `reports/xapi-statements.json`

Supabase setup + RLS policies
-----------------------------

This project uses Supabase (Auth + Postgres) and relies on Row-Level Security (RLS) for ownership and teacher/student RBAC. Follow these steps to prepare a Supabase project for TorqueMind.

1. Create a Supabase project and note the `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and service role key (`SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`). Store them in your environment or CI secrets.

2. Apply the SQL policies found in the repository under `db/` using the Supabase SQL Editor. Key files:
	- `db/replays_policy.sql` — enables RLS on `replays` and adds insert/select policies scoped to `auth.uid()`.
	- `db/classroom_policies.sql` — RLS policies for `completions`, `enrollments`, `assignments`, and any `WITH CHECK` constraints needed for authenticated inserts.

	To apply: open the Supabase project dashboard → SQL Editor → New query, paste the contents of each file and run them. Confirm there are no errors.

3. Verify profiles/roles: the API expects a `profiles` table with a `role` column (values like `teacher` or `student`). Ensure teachers have `role = 'teacher'`.

4. CI secrets: Add the following to your GitHub Actions repository secrets (do NOT commit keys to Git):
	- `SUPABASE_URL`
	- `SUPABASE_ANON_KEY`
	- `SUPABASE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
	- `TEST_TEACHER_EMAIL` and `TEST_TEACHER_PASSWORD` (used by the smoke test)

5. Troubleshooting notes:
	- If inserts fail with "new row violates row-level security policy", check the table's `WITH CHECK` policy and ensure the insert payload sets ownership columns server-side (the API enforces `user_id = req.user.id` before inserting).
	- To temporarily enable verbose logging for debugging, set `DEBUG_API=true` (for API runtime logs) or `DEBUG_AUTH=true` (for auth middleware). Remove or unset these in production.

If you want, I can (a) paste the exact SQL from the `db/` files here, or (b) apply them to your Supabase project if you provide explicit, ephemeral service-role credentials and consent.

Tests
-----

Tests are split between unit tests (Jest) and end-to-end tests (Playwright).

- Run unit tests: `npm test`
- Run Playwright E2E: `npm run test:playwright`

## Ollama via Cloudflare Tunnel

TorqueMind can use a locally hosted Ollama instance through a Cloudflare Tunnel protected by Cloudflare Access.

### Rollout documentation

- `docs/ollama-tunnel-design.md`
- `docs/ollama-tunnel-staging-checklist.md`
- `docs/ollama-cloudflared-access-setup.md`
- `docs/ollama-cloudflared-windows-service.md`

### Helper scripts

Upload the Cloudflare Access service-token credentials to the staging Worker:

```powershell
powershell `
	-NoProfile `
	-ExecutionPolicy Bypass `
	-File .\scripts\add-ollama-secrets.ps1
```
Verify the Access-protected Ollama tunnel directly:

```powershell
powershell `
	-NoProfile `
	-ExecutionPolicy Bypass `
	-File .\scripts\verify-ollama-tunnel.ps1 `
	-TunnelHost "https://ollama.example.com"
```
After the tunnel verification returns HTTP 200 for both `/api/tags` and `/api/chat`, build, deploy, and test the staging Worker:

```powershell
powershell `
	-NoProfile `
	-ExecutionPolicy Bypass `
	-File .\scripts\deploy-and-test-staging.ps1
```
Do not activate a placeholder hostname. Update `wrangler.jsonc` only after the real tunnel hostname and Cloudflare Access application are operational.

The staging rollout is complete only when `/api/torquemind-feedback` returns HTTP 200 with:

- `reasonIncorrect`
- `reasonCorrect`
- `aseConcept`
- `nextStep`
- `x-request-id`
- rate-limit headers


Playwright is configured to only run tests under `tests/playwright` to avoid accidental discovery of Jest tests.
