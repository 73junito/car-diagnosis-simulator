# Cloudflare Preview Retention Evidence Gate

This offline, read-only gate cross-checks the complete Cloudflare live-preview eligibility manifest and complete PR ownership manifest by exact preview ID, branch, live status and identity. It rejects partial, duplicate, or mismatched evidence and cannot authorize deletion.

For records matched to merged PRs with verified live preview identity, the existing 30-day retention decision controls the next action. `retained` becomes `retain_30_day_window`. `review_required` becomes `dependency_evidence_required`, **not** deletion approval. The gate marks all Worker binding and storage dependencies `not_verified`; these require separate inspection before proposing any destructive action. Unverified or ambiguous PR ownership remains protected.

The existing live-preview audit workflow generates `cloudflare-preview-retention-evidence.json` only when the complete ownership manifest and eligibility manifest are available, and includes it with the audit artifact. No new Cloudflare API privileges, mutation calls, migration or cleanup automation are introduced.

The locally assessed October 17, 2026 full manifest (549 records) yielded 423 `retain_30_day_window`, 3 `retain_closed_unmerged`, and 123 `retain_unverified`; zero deletion-authorized records. These results describe the captured audit snapshot, not a fresh live dependency verification.
