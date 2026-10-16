# Alternator accessible review viewer — local dependency milestone

Build the seven-part GLB with `node scripts/build-alternator-prototype.js`, serve the repository root over HTTP, and open `/animation/cadquery/review/`. The ignored GLB is never committed or published.

## Reviewed dependency packaging
This review-only page imports **same-origin** Three.js 0.186.1, copied from the npm package `three@0.186.1`, matching the version resolved by the repository's lockfile. A minimized dependency subset is checked in under `vendor/three/` (core/module, GLTFLoader, OrbitControls, required utilities). Its MIT license is provided at `vendor/three/LICENSE`. No CDN or remote script imports remain in this viewer. Do not use the files as the authoritative upstream source; review future dependency updates against the lockfile and license.

## Accessibility and failure behavior
Play/Pause/Reset are native keyboard buttons, speed uses a native select, status uses a live region, and reduced-motion preferences prevent animation. If rendering or loading fails the canvas is hidden, a text description appears, and playback controls remain disabled. This is a *fallback*, not a substitute for a full assistive-technology audit. The scene itself does not currently expose keyboard-operable camera manipulation or component navigation.

Browser validation with regenerated GLB (Chromium/Playwright): keyboard Play/Pause/Reset, synchronized pulley/shaft rotation, stationary stud, and OS reduced-motion settings passed with no page errors. A focused Jest test verifies same-origin assets, license, and fallback markup.

## Release gates still blocked
This viewer remains review-only. No qualified mechanical dimensional validation, independent screen-reader audit, governed electrical test-point mappings, assessment eligibility, or publication authority is claimed. Do not link this page into the student dashboard or ship to production lessons without those reviews.
