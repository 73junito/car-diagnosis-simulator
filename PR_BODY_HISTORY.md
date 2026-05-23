## Summary

Adds the history endpoint for persisted telemetry with pagination and session filtering.

## Behavior

* Default `limit` = 50
* Hard max `limit` = 500
* Newest-first ordering (sorted by `created_at` desc)
* Session filtering via `?session=...` or `?sessionId=...`
* Graceful fallback when Supabase env vars are absent (returns `{ ok:false, data: [] }`)
* No replay/export/UI features included in this PR

## Files

* `api/telemetry/history.js`
* `tests/telemetry-history.test.js`

## Notes

Uses the existing `api/telemetry/storage.js` adapter. Tests mock the storage adapter.
