# Alternator motion, review-only

This prototype controller is **not** wired into the student-facing Circuit Lab. It operates on a validated Seven-node Three.js scene loaded from the independently generated CadQuery/Blender GLB.

`animation/alternator-motion.js` exports `createAlternatorMotion(scene, { reducedMotion })`. Its caller must load the GLB and call `start()`, `step(deltaSeconds, illustrativeRpm)`, `pause()`, `reset()`, and `dispose()`.

The controller requires the named pulley and rotor shaft, stationary housing/connection parts, explicit runtime-driven metadata, and the fail-closed presentation-only authority flags. Both rotating components turn about their individual local X axes; stationary housing/terminal meshes do not rotate. Reduced motion prevents movement. Frame delta is capped at 100 ms and speed at 15,000 illustrative rpm; these limits are *visual controls, not alternator specifications*.

No electrical test-point IDs, circuit values, assessment eligibility, vehicle specifications or student runtime integration are provided by this controller. A technical reviewer must validate physical design, rotation origins, camera visual, human-operable controls, and real-world specifications before any publication.

Focused tests: `npx jest tests/alternator-motion.spec.js --runInBand`.
