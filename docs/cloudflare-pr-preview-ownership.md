# Cloudflare PR-to-preview ownership reconciliation

This enhancement adds a **read-only ownership report** to the existing live-preview audit workflow. It does not alter Cloudflare Worker or Durable Object configuration and does not call preview deletion APIs.

On a complete audit of the full Cloudflare Builds preview list, the script correlates every preview's branch with the fully paginated GitHub PR inventory. The report contains GitHub PR state (open, merged or closed unmerged), same-repository branch context, and separately obtained Cloudflare live preview identity. A matching branch name **is not proof of ownership**.

- Open PRs are retained.
- Closed unmerged PRs are retained.
- Unmatched, reused/ambiguous, foreign-repository and unverified preview identities are retained pending review.
- Uniquely matched merged same-repository PRs with an independently verified matching live-preview ID are marked `cleanup_review_only`, **never deletion-authorized**.
- Incomplete live audits do not generate an ownership report. The existing eligibility manifest and manual protected cleanup workflow remain unchanged.

The workflow artifact `cloudflare-preview-eligibility-manifest` now additionally contains `cloudflare-preview-pr-ownership.json` when a complete scan succeeds. No tokens or other secret values are written. Do not use this report as the sole authorization for preview cleanup: verify live Worker bindings, preview deployment ownership, retention and application dependencies, and obtain explicit approval before any deletion.
