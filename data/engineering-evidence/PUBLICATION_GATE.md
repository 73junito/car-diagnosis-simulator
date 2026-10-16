# Engineering evidence → component reuse → 3D publication gate (proposal)

This is an **offline, fail-closed governance decision**. It does not modify the student lab UI, GLB files, Meshy generation, assessment eligibility, simulation equations, deployment configuration or the production publication pipeline.

## Inputs and run

```sh
node scripts/check-3d-publication-gate.js \
  data/engineering-evidence/lab-source-register.json \
  data/component-reuse/actuator-bracket-example.json \
  request.json authorization.json
```

The caller supplies a reuse request with `use` (`visual` or `geometry`), `application`, and `sourceRevision`, and a separate approval record. A non-approved decision prints `blocked` and exits nonzero. The default bracket and existing engineering reviews are **not approved**, so they stay blocked.

## Publication authorization (trusted record)

A publication approval has `assetId`, `assetRevision`, `application`, `use`, `status: "approved"`, `reviewer`, `evidence`, `reviewedAt`, `rightsStatus: "cleared"`, `accessibilityStatus: "passed"` and `performanceStatus: "passed"`. This signoff is separate from component reuse approval and from engineering review; the publication reviewer must differ from the engineering reviewer.

An asset-specific engineering review in the source register must refer to existing source IDs and include `status: "approved"`, `technicalReviewer`, `reviewEvidence`, and no outstanding `geometryGaps`. A source citation or distributor discovery record alone does not approve specifications. Rights, model-specific dimensions and verified pinouts are **never inferred** from a GLB.

## Security and deployment boundary

This first integration is a decision contract, **not production enforcement**. Supplied JSON could be forged. Before coupling it to CI/CD or asset delivery, source the approval records from an authorized, immutable/reviewable workflow with reviewer identity verification, require exact digest/revision binding for approved GLBs and evidence, and protect the publication step from bypass. No student assessment or safety approval is inferred from an asset release. Never treat the script's positive return value as authentication of reviewer identity.

Run `npx jest tests/engineering-reuse-publication-gate.spec.js --runInBand` and existing policy tests before promotion. Keep this PR draft pending repository CI and reviewer verification.
