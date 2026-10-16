# Protected 3D asset promotion — manual review stage

The manual `3D Asset Promotion Review (No Publish)` workflow is **review-only**. It checks candidate paths, runs the existing fail-closed preflight and reports the blocked decision. It **does not** authenticate reviewers, approve 3D assets, produce releasable assets, publish to Cloudflare, or change student assessments.

## Required administrator setup
1. Create a GitHub Actions environment named `asset-promotion-review`.
2. Configure required reviewers, prevent self-review where supported, and restrict deployment branches to protected `main`.
3. Require pull-request review and status checks before changes to the workflow and to asset governance scripts reach `main`.
4. Confirm repository and organization policy denies untrusted workflows any write credentials or deployment credentials.
5. Do not add production secrets to this review-only environment.

GitHub environment settings are **not** created or verified by this PR. Until the settings are confirmed, the environment reference itself does not prove reviewer authorization.

## Trust boundary and next phase
The workflow runs using `contents: read`, with no publication step. The existing preflight CLI always supplies `trustedApproval: false`; the review workflow explicitly checks for that denial. Any malformed output, unexpected success, or missing trust-block reason fails the job.

Before **actual** asset promotion can be enabled, introduce a separately authenticated server-side approver service, a cryptographically auditable record binding reviewer identities to GLB digest, source/reuse evidence revisions and destination, an unbypassable artifact delivery gate, and integration tests proving unauthorized direct upload is impossible. Deployment credentials must live only in the protected publisher, not in this review job.

Manual dispatch inputs must point at files committed to the default branch. A passing job means **the governance denial mechanism operated correctly**, not that the candidate is approved.
