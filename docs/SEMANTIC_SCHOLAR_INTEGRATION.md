# Semantic Scholar Research Discovery Integration

## Purpose

AutoLearnPro uses the Semantic Scholar API for scholarly research discovery and bibliographic metadata retrieval. Initial production scope is intentionally limited to paper search and individual paper metadata.

Semantic Scholar results are discovery inputs only. They do not automatically become approved curriculum evidence, human-reviewed instructional content, or scored-assessment material.

## Server-side secret

Production uses the Cloudflare account-level Secrets Store rather than duplicating the key into GitHub or a per-Worker secret.

- Secrets Store ID: `c32646eb8bd1485b89b3dbf184fe933d`
- Secret name: `Semantic_Scholar`
- Worker binding: `SEMANTIC_SCHOLAR_API_KEY`

The binding is declared in `wrangler.app.jsonc` with `secrets_store_secrets`. Worker code retrieves the value asynchronously with `await env.SEMANTIC_SCHOLAR_API_KEY.get()`.

For local development and unit tests only, `.dev.vars` may provide a plain `SEMANTIC_SCHOLAR_API_KEY` string. Production must use the Secrets Store binding.

Never place the key value in browser JavaScript, JSON data files, Git history, Wrangler `vars`, logs, tests, screenshots, or documentation.

## Routes

- `GET /api/research/semantic-scholar/search?q=<query>&limit=<1-10>`
- `GET /api/research/semantic-scholar/paper/:paperId`

Both routes require:
- Semantic Scholar integration enabled
- a valid Supabase bearer token
- trusted `app_metadata.role` of `instructor`, `professor`, or `admin`

Production is enabled by default. Preview, staging, and local examples are disabled by default so separate Worker instances cannot independently consume the same cumulative Semantic Scholar quota. Enable a non-production environment only for deliberate testing with coordinated quota controls.

## Rate protection

Semantic Scholar approved the project at 1 request per second cumulative across endpoints. AutoLearnPro uses the existing Durable Object binding with one global object named `semantic-scholar-global` and defaults to one upstream request per two-second window. This is intentionally below the approved ceiling.

The client also applies:
- request deduplication inside a Worker isolate
- metadata caching
- bounded retries
- exponential backoff for network failures, 429 responses, and 5xx responses
- fail-closed behavior if the global rate coordinator is unavailable

## Governance

Every API response explicitly marks results:
- `reviewStatus: unreviewed`
- `assessmentEligibility: none`
- `curriculumApproval: not-granted`
- `humanReviewRequired: true`

Downstream workflows must preserve paper ID, DOI/external IDs, title, authors, year, venue, Semantic Scholar URL, and retrieval time when a result is selected for evidence review.

## Attribution

The public site includes `/research-sources/` with Semantic Scholar attribution. This supports the attribution requirement communicated with the approved API key.
