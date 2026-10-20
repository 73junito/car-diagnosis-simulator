# Shared simulation-state cooling-fan demonstrator

This is an **isolated developmental educational model**, not integrated with the canonical vehicle diagnostics, assessment state, laboratory progression, Supabase, Cloudflare Workers, or student grading.

## Files
- `engine/sharedCoolingFanSimulation.js`: deterministic common state returned to any future instruments, charts, or visualization adapters.
- `index.html`, `demo.js`: accessible text readings plus SVG playback of the *same* state.
- `tests/shared-cooling-fan-simulation.test.js`: unit/regression contract.

Serve the repository root over HTTP, then open `/dashboard/student/cooling-fan-demo/`. Run `npx jest tests/shared-cooling-fan-simulation.test.js --runInBand`.

## Model boundaries
The model applies a bounded, stepped illustrative first-order cooling equation, with hypothetical 13.8 V/9 V and 12 A/8 A readouts and no fan-voltage/airflow coupling. These are not verified vehicle measurements or OEM parameters. The model does not infer thermal safety, engine health, component failure or a diagnostic conclusion. The fan graphic visualizes `state.visual`; it never simulates physics independently.

## Next integration PR
1. Specify authoritative shared state/event schema with versioning and adapters for specialized lab engines.
2. Add independent engineering/model and automotive SME reviews.
3. Connect approved instruments and motion state; keep their displayed values sourced from this state.
4. Validate cross-domain simulation and limits, then assess accessibility, performance and governance.
5. Do not publish in the production course, mark as assessed, or connect to live vehicles without separate authorization.
