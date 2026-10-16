# Alternator 3D prototype — review-only

This is an experimental **Meshy reference → CadQuery → Blender → GLB** path. It is not a published lesson asset.

- Meshy task `01a142b8-6fad-70a7-be9a-3e3bdfb571a0` provided visual inspiration only; its 30,322-triangle GLB is **not** used as dimensional source.
- `animation/cadquery/scripts/build_alternator_prototype.py` produces seven separate, illustrative STL/STEP components and a governance manifest.
- `animation/blender/scripts/convert_alternator_prototype.py` exports seven named GLB meshes, including independently addressable pulley and shaft objects.
- `node scripts/build-alternator-prototype.js` runs the pipeline and verifies the generated review artifact.

All dimensions are approximate, illustrative millimeters; mounting, electrical connections, internal rotor geometry and fit have **not** been validated against a real alternator. No simulated measurement, voltage, acceptable value, assessment scoring, publication state, or diagnostic authority is derived from this model.

Output lives under `animation/cadquery/output/alternator-prototype/` and is ignored by Git; do not copy to student-facing asset paths until human technical review and governed runtime tests pass.

## Remaining gates

1. Visual inspection and dimension review by a qualified subject matter expert.
2. Confirm pulley and shaft origins/axes in a rendered Three.js test.
3. Add runtime-driven animation and accessibility/fallback tests.
4. Bind only separately governed and authenticated test-point IDs.
5. Verify performance, licensing/provenance, and independent publication approval.
