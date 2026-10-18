# AUT-250 Technical Literature and Curriculum Evidence Register

Status: initial bibliography, not comprehensive review, technical approval, OEM specification, license clearance, or assessment authority.

Data file: data/curriculum/aut250-literature-evidence.json. This is a course-specific supplement to the existing broader source registries, not their replacement.

## Coverage
- ASE A8 2026: engine-performance task alignment; exact course mapping pending.
- HELLA ignition coil: component construction, supply, switching, alternative failure modes.
- Pico ignition guided tests and primary current: waveform interpretation and precautions; link only.
- NGK/NTK TekniWiki: ignition, sensors, fuel-air topical discovery pending detailed verification.
- EPA: OBD/emissions and readiness context, not root-cause proof.
- OpenStax University Physics 2: inductance principles, not vehicle service procedure.
- User-supplied Lime Book: historical Chevrolet V8 engine identification only. All rights reserved.

## Priority engineering gaps
1. Define fictional engine coil architecture, circuit diagram and test points.
2. Differentiate internal winding open from connector, harness, power and control faults under matching conditions.
3. Validate whether isolated resistance testing is supported, including intermittent temperature/vibration states.
4. Review electrical/high-voltage safety; do not use provisional simulated values as real-world procedures.
5. Produce SME-reviewed fault truth tables across normal, fault-active and post-repair conditions.
6. Clear rights for any copied illustrations, text or datasets; default is external link-only.
7. Expand detailed mapping for fuel, air induction, emissions, engine mechanical and electronics topics.

## Governance
Bibliographic metadata and URLs only; no RAG, embeddings, vendor text ingestion, diagrams, waveforms, transcripts or grade authority. Source verification means a source location has been identified, not independent validation. License and technical reviews remain pending. Existing canonical governance registries must be reconciled before production use.

Validation commands: node scripts/verify-aut250-literature-evidence.js; Jest tests/aut250-literature-evidence.spec.js.
