# AUT-250 R2 integration design and compatibility review

**Status:** Design proposal only. No runtime, grading, deployment, or engineering validation. **Course:** AUT 250 Automotive Diagnostics I (planned).

## Reviewed source boundaries
- R1 engine: `engine/aut250MisfireLab.js` uses Node CommonJS and `node:crypto`; it produces qualitative primary-current state rather than sampled waveform data.
- Engine compatibility: `contracts/aut250-engine-integration/contract.js` explicitly binds the cylinder-2 R1 identity and DCAF provenance rules.
- Student lab UI mock remains a **different scenario**: cylinder-3 ignition secondary open, not a valid R2 engine provider.
- Cline's reusable assets are data-driven and render unavailable fields as not supplied; oscilloscope graph channels require finite time/value samples.
- R2 technical truth table: `data/curriculum/aut250-ignition-truth-table.json`, developmental, SME approval outstanding.
- Curriculum matrix: `data/curriculum/aut250-outcome-alignment-matrix.json`, maps the evaluation learning outcome to planned competency `ug-aut250-systematic-diagnostics`, with no scoring approval.

## Integration architecture proposal
Provider (versioned simulated engine observation) → explicit adapter/translator (identity, units, provenance and admissibility checks) → instrument payload contract `0.1.0` → passive lab equipment views. A separate evidence mapper records original engine events and links instrument displays by observation IDs; visualization MUST NOT produce observations, infer component truth, alter repair eligibility or grade students.

The R1 `node:crypto` engine must not be imported directly in browser assets. Choose a separately reviewed server-side provider or a browser-safe extracted core in a future PR. Do not present the asset showcase's demonstration readings as actual R2 data.

## Blocking compatibility gaps
See machine-readable `data/curriculum/aut250-r2-integration-readiness.json` for seven review findings and fail-closed gates. Most important: cylinder-3 UI mock versus cylinder-2 engine fault; narrative/qualitative scope observation versus sampled waveform requirement; visual inspection misclassified as DVOM; static harness continuity insufficient to rule out intermittency; external driver command not proof of winding defect.

## Next reviewed implementation sequence
1. Agree on the fictional circuit diagram, driver topology, safe probe boundaries and conditions with SME reviewers.
2. Confirm normal, fault-active, post-repair truth states and the isolated primary-winding diagnosis.
3. Approve observation schema (test ID, version, instrument, unit, condition, test point, provenance and explicitly missing measurements).
4. Implement deterministic read-only provider and adapter, without inventing waveform points, numeric limits, repair conclusions or grading.
5. Validate engine/UI/evidence compatibility, reject unrecognized tests and scenario identities, then accessibility/performance review.
6. Gate pilot access and any scoring on separate institutional decisions.

**No approval flags should be changed as a consequence of merging this design.**
