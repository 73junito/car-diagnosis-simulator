# Contributing

Thank you for contributing to AutoLearnPro / TorqueMind.

## Pull-request workflow

All repository changes should be made on a focused branch and submitted through a pull request targeting `main`.

Typical workflow:

```bash
git switch main
git pull --ff-only
git switch -c <type>/<short-description>
# make and test changes
git push -u origin <type>/<short-description>
```

Keep pull requests small enough to review. Separate unrelated migrations, content approvals, architecture changes, and UI work when practical.

## Before opening a PR

Run the checks relevant to your change. Common commands include:

```bash
npm test
npm run lint
npm run test:playwright
npm run test:supabase-contracts
npm run build
```

For curriculum, evidence, architecture, engineering, or database work, also run the corresponding validators listed in `package.json`.

`git diff --check` should pass before commit.

## CI and branch protection

The exact required GitHub status checks can evolve. Treat `docs/ci-contract.md` and the repository's current branch-protection/ruleset configuration as authoritative rather than hard-coding an old check list here.

Do not fabricate, manually spoof, or bypass required statuses. If a required workflow is stale or misconfigured, fix the workflow or obtain an explicit repository-admin exception through the documented process.

## Review requirements

Changes affecting any of the following require especially careful review:

- authentication or authorization
- Supabase RLS or privileged database access
- assessment attempts, grading, scoring, or result release
- evidence/provenance validation
- content rights or reuse status
- learner privacy or telemetry
- safety-related instructional content
- Cloudflare routing or production deployment

Prior approval for one artifact or content batch must not be copied forward as approval for a different artifact, batch, use, or delivery mode.

## Assessment and training boundary

Training content and assessment content are governed separately.

Do not change flags, database records, APIs, tests, or UI wording in a way that converts training approval into assessment eligibility without a separate, explicit approval record and the corresponding technical gates.

## Database migrations

- Add schema changes through `supabase/migrations/`.
- Prefer additive, fail-closed migrations.
- Preserve historical migrations.
- Do not seed approval or eligibility records merely to satisfy tests.
- Verify migrations against the disposable-Postgres CI workflow when applicable.

## Source and rights handling

Do not assume that material is reusable merely because it is publicly accessible. Record source, license/rights status, and approval scope before incorporating third-party text, media, datasets, or substantial excerpts.

Repository code licensing does not override third-party terms.

## Security

Never commit secrets or private user data. Follow `SECURITY.md` for vulnerability reporting.

## Generated files

Avoid committing generated artifacts unless the repository intentionally tracks them. If a build or validation command modifies a generated file unexpectedly, review and revert it unless the change belongs in the PR.

## Documentation

Architecture changes should update the relevant documentation and Mermaid diagrams where the runtime or governance model changes.

Key references:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/architecture/shared-attempt-governance.md`
- `docs/ci-contract.md`
- `SECURITY.md`

## Code of conduct

Participation in this repository is governed by `CODE_OF_CONDUCT.md`.