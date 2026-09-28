# Security Policy

## Supported versions

Security fixes are maintained for the current `main` branch and the currently deployed production services. Older commits, abandoned branches, local development snapshots, and historical preview deployments are not supported unless a maintainer states otherwise.

## Reporting a vulnerability

Please **do not open a public issue** for a suspected vulnerability.

Use GitHub's private vulnerability reporting / Security Advisory workflow for this repository when available:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability** or create a private security advisory.
3. Include the affected component, impact, reproduction steps, and any suggested mitigation.

If private vulnerability reporting is unavailable, contact a repository maintainer privately and ask for a secure reporting channel. Do not send secrets or exploitable details through a public issue, discussion, pull request, or commit.

## What to include

A useful report includes:

- affected URL, route, file, or component
- vulnerability class and expected impact
- minimal reproduction steps
- whether authentication is required
- relevant request/response details with secrets removed
- browser/runtime/version information when relevant
- suggested mitigation, if known

Never include real passwords, service-role keys, access tokens, private learner records, or other sensitive data in a report unless a maintainer has provided an approved secure channel.

## Security boundaries

### Authentication and authorization

- Privileged APIs must authenticate Supabase-issued bearer tokens.
- Server-side ownership checks must not rely on editable client metadata.
- Service-role credentials must remain server-side.

### Database

- Sensitive tables should use RLS and explicit privilege grants.
- Assessment and audit records must fail closed on ownership, state, scenario, delivery-mode, and eligibility mismatches.
- Schema changes belong in reviewed migrations; do not patch production schema manually as a substitute for source-controlled migrations.

### Question and assessment integrity

- Correct answers must not be exposed in learner question-delivery payloads.
- Training approval is not assessment eligibility.
- Future assessment question assignment, grading, and finalization must be server authoritative.
- Security or governance checks must not be disabled to make an assessment available.

### Secrets

Never commit:

- Supabase service-role keys
- API tokens
- passwords
- private keys
- Cloudflare credentials
- OAuth client secrets
- learner credentials
- production database connection strings containing credentials

Use environment variables, GitHub Actions secrets, and platform secret stores instead.

## Automated security controls

The repository uses automated checks that may include CodeQL, dependency tooling, linting, unit tests, browser tests, API smoke tests, database migration checks, and Supabase security/package contracts.

Passing automation does not replace human review for authentication, authorization, privacy, rights, safety, or assessment-governance changes.

## Disclosure

Please allow maintainers a reasonable opportunity to investigate and remediate a reported issue before public disclosure. Coordinated disclosure timing should be agreed through the private report.

## Licensing and third-party materials

Security reporting does not grant any license to repository or third-party content. Repository-wide licensing is under review unless an individual file or source expressly states otherwise.
