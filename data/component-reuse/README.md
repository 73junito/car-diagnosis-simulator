# Controlled Component Reuse and Tolerance Policy (internal v1)

**Principle:** reuse validated methods and appropriate geometry, but revalidate actual component specifications, operating limits and statistical assumptions for the destination application. These are AutoLearnPro internal classes, **not ISO/SAE/ASTM classifications**.

Classes: `generic` (illustrative), `dimensionally-controlled` (parametric geometry, dimensional/fit verification), `manufacturer-specific` (exact part, variant, datasheet revision and conditions), `statistically-validated` (population/method evidence), `safety-critical` (application-specific safety signoff).

Manifests must identify source provenance, revision, application scope, approved uses, evidence and reviewer. Every reuse request is evaluated by `scripts/validate-component-reuse.js` and yields `approved`, `revalidation-required`, or `prohibited`. Missing permissions prohibit use; missing evidence forces revalidation. **A GLB is never the authoritative source for manufacturing dimensions, terminal limits or grading.**

Example bracket: 8.0 mm ±0.1 mm hole is **illustrative**. This is an allowed interval of 7.9–8.1 mm, not a manufacturing standard-deviation estimate. Hole-to-fastener fit and manufacturing process capability require independent evidence. The example manifest remains pending, so geometry reuse is blocked pending dimensional/fit review.

Separation of layers: asset geometry; part-number-matched specification; runtime equations and regression-tested software contracts; independent statistics; and explicit governance approval. No approval of one layer automatically approves another. High voltage/safety and assessment require additional independent signoff. This package implements a standalone **review decision contract**, not automatic runtime enforcement or publication wiring.

Usage: `node scripts/validate-component-reuse.js manifest.json request.json` (non-approved decisions exit nonzero). Do not copy model-specific values between labs solely because they share visual connectors or housings.
