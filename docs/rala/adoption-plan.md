# Adoption Plan

## Phase 1 — Governance and skills

- Install shared RALA architecture documentation.
- Install project and domain Agent Skills.
- Add architecture checks to pull-request review.
- Document authority boundaries.

## Phase 2 — Offline foundation

- Add a versioned service worker.
- Add an IndexedDB repository and idempotent outbox.
- Add explicit cache manifests and offline fallback.
- Add service-worker tests.

## Phase 3 — Domain agent interfaces

- Introduce typed agent input/output contracts.
- Require structured recommendations.
- Validate recommendations before application.
- Record provenance, model, skill, and policy version.

## Phase 4 — Cloud orchestration

- Add Cloudflare Agents SDK where durable identity or real-time sessions are needed.
- Use Durable Objects, D1, R2, and Queues according to workload.
- Add human approval for consequential actions.

## Phase 5 — Evaluation and reuse

- Run skill-trigger and output-quality evaluations.
- Test offline/online parity.
- Extract shared packages only after both applications demonstrate the same stable need.
