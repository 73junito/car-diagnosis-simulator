# Semantic Scholar Research Discovery Integration

## Purpose

AutoLearnPro uses the Semantic Scholar API for scholarly research discovery and bibliographic metadata retrieval. Initial production scope is intentionally limited to paper search and individual paper metadata.

Semantic Scholar results are discovery inputs only. They do not automatically become approved curriculum evidence, human-reviewed instructional content, or scored-assessment material.

## Server-side secret

Configure the API key only as the Cloudflare Worker secret:

```
SEMANTIC_SCHOLAR_API_KEY
```

Never place the key in browser JavaScript, JSON data files, Git history, Wrangler `vars`, logs, tests, screenshots, or documentation.

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
