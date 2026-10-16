# 3D asset publication integrity preflight — staged enforcement

This phase adds `scripts/preflight-3d-asset-publication.js` and focused tests, layering SHA-256 asset-binding checks on the #1020 governance decision.

## Controls
- The model's bytes must match the exact 64-character lowercase SHA-256 digest in the publication authorization.
- The expected digest must match the authorization's digest.
- Evidence, reuse, revision, licensed redistribution, accessibility, and performance reviews remain mandatory.
- A separate protected promotion service must authenticate approver identity and supply the `trustedApproval` signal **out of band**.
- This repository's CLI deliberately always passes `trustedApproval: false`, so standalone execution cannot authorize or publish assets.

## Important boundary
The `preflight` JavaScript function accepts an externally supplied trust assertion for integration testing and subsequent trusted-server integration. This boolean is **not a security credential** and must never be exposed as a request-controlled field, workflow_dispatch input, environment variable, or untrusted JSON property. A future protected environment must establish signed review provenance, review identity and separation of duties, immutable artifact digests, and server-side promotion access controls.

No deploy or artifact publishing action is implemented here. No existing assets, assessment functions or simulations are changed. This PR must not be described as end-to-end production enforcement.

Tests: `npx jest tests/asset-publication-integrity-preflight.spec.js --runInBand`.
