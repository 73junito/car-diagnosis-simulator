## Summary

Adds the first enforcement layer for TorqueMind’s approved-source and citation-governance architecture.

This PR introduces:

- approved-source and large-chunk database schema
- RLS policies for provenance records
- reviewer/admin role helper functions
- controlled approval-state transitions
- approval constraints requiring answer and explanation citations
- append-only provenance audit behavior
- approved-source registry scaffolding
- large-chunk generation scaffolding
- file-based provenance CI gates
- disposable PostgreSQL integration testing in GitHub Actions

## Safety model

Student-facing graded content remains fail-closed:

- draft questions cannot be used in graded attempts
- approved questions must resolve to approved sources and chunks
- direct `draft -> approved` transitions are rejected
- required citation roles must exist before approval
- cited source and chunk records must both be approved
- provenance audit rows cannot be updated or deleted by client roles

No instructional source is approved by this PR. The registry remains empty until authorized works and licensing metadata are added.

## Database objects

- `approved_sources`
- `source_chunks`
- `question_provenance`
- `question_citations`
- `provenance_audit`

## CI and integration validation

- SHA-256 checksum and chunk-hash format checks
- fixture entity uniqueness
- approved chunk locator validation
- RLS presence checks
- approval-transition guard checks
- append-only audit-policy checks
- role-helper function checks
- disposable PostgreSQL migration and enforcement job

## Local validation

- `npm ci` — passed
- provenance CI Jest tests — passed
- lint — completed with warnings only
- full Jest suite — 79/79 suites, 301/301 tests
- `git diff --check` — clean except existing LF/CRLF warning

## Notes

- The database integration workflow provisions disposable PostgreSQL.
- Local integration testing requires matching `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`.
- The reviewer helper currently assumes `public.profiles(id uuid, role text)`.
- This PR does not add embeddings or publish approved instructional content.
- PR #337 remains separate and should be reviewed/merged independently.
