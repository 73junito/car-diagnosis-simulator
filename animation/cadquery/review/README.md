# Alternator accessible review viewer

Run `node scripts/build-alternator-prototype.js`, then serve the **repository root** over HTTP and navigate to `/animation/cadquery/review/`. The generated GLB remains ignored under `animation/cadquery/output/alternator-prototype/`; the page is intentionally **not** linked or packaged in student production routes.

This browser-based Three.js review page offers keyboard-operable Play/Pause/Reset buttons, three illustrative visual speeds, a status live region, a descriptive text alternative, and operating-system reduced-motion handling. It reuses the governed seven-part alternator controller. The Three.js import map references a pinned jsDelivr version and requires network availability; review that dependency before deployment.

Local Chromium/Playwright smoke: generated GLB loaded; Play advanced pulley and shaft to equal nonzero angles; output stud stayed at zero; Pause/Reset worked; zero page errors.

**Not approved:** mechanical fit/specifications, production accessibility audit, circuit/electrical test points, scoring or publication.
