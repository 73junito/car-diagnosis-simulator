# AutoLearnPro 3D Asset Realism and Quality Framework v1

This review contract applies to Meshy references and project-authored CadQuery/Blender assets. Appearance **does not** confer engineering, measurement, assessment, or publication authority.

Review priorities in order:
1. **Silhouette and proportions** — realistic visual silhouette, relative dimensions and component orientation; compare with licensed, technically credible references.
2. **Connectors, terminals and mounting geometry** — instructor-checked correct terminal locations, plug interfaces and mounting relationships. Never infer pinouts or test points from generated geometry.
3. **Materials and lighting** — distinguish conductive metals, polymers and insulation under representative browser lighting.
4. **Cutaways and component separation** — educationally meaningful isolation, independently addressable components and governed runtime-controlled motion.
5. **Surface detail and textures** — only add details after technical geometry passes; measure GLB size, device loading and GPU demand.

## Review gates
Criteria 1 and 2 are mandatory technical gates. Each requires explicit evidence, a reviewer identity, and a `pass` verdict. Failing or pending status blocks publication regardless of visual polish. Remaining three criteria must also pass before publication eligibility. Publication additionally requires an explicit publication-candidate purpose and separate approval. A valid *review-only* report is never publishable.

Use `node scripts/validate-3d-asset-review.js path/to/review.json` to test eligibility. The validator exits nonzero on any invalid or non-publishable report. Review-only evidence may legitimately fail the command; do not make a sample pending review a required passing publication test. Use `require('./scripts/validate-3d-asset-review').validate(report)` in tests or future pipeline integration.

The report represents **human evidence**; the validator checks its presence and approval state, not truth of dimensions or source rights. Do not automatically flip a status to pass based on Meshy output, GLB parse success, animation tests or lighting appearance.

## Alternator starting position
`animation/asset-reviews/alternator-review.json` records the current seven-node prototype as review-only. Its structure and pivots passed automated checks, but neither silhouette/proportions nor connection/mount geometry has human technical signoff. Student publication and new electrical/assessment authority remain blocked.
