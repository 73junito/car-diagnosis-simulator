# Gate 2B Decisions, Risks and Gate 2C Acceptance Criteria

Status: Gate 2B record
Scope: shared contracts, coverage plan, Starting-System v2.0.0 model and fixtures

## What Gate 2B delivered

| Deliverable | Location |
| --- | --- |
| Shared multi-domain contracts | `contracts/*.ts` (7 modules) |
| Versioned JSON schemas | `schemas/model-manifest.schema.json`, `schemas/lab-domain-coverage.schema.json`, `schemas/circuit-template-v2.schema.json` |
| Strict type checking | `tsconfig.json`, `npm run typecheck` |
| 17-laboratory domain coverage plan | `data/architecture/lab-domain-coverage.json`, `docs/engineering/lab-domain-coverage.md` |
| Mode interface definitions | `contracts/modes.ts`, `docs/engineering/multi-domain-contracts.md` |
| Vehicle-data gateway interface (design only) | `docs/engineering/vehicle-gateway-interface.md` |
| Starting-System template v2.0.0 | `data/circuit-templates/12v-starting-system-v2.json` |
| Hand-authored expected netlist | `tests/simulators/starting-system-v2-expected-netlist.json` |
| Hand-calculated expected values | `tests/simulators/starting-system-v2-expected-values.json` |
| Independent ngspice reference decks | `engineering/ngspice/starting-system-v2-*.cir` (5 decks) |
| Contract validation and regression tests | `tests/simulation-contracts.spec.js`, `tests/starting-system-v2-fixtures.spec.js` |

**Not delivered, by design:** no numerical engine, no Web Worker, no vehicle
communication, no new database persistence.

## Decisions taken in Gate 2B that require owner ratification

| # | Decision | Rationale | Reversible? |
| --- | --- | --- | --- |
| D1 | Added `typescript@7.0.2` as an **exact** devDependency and `npm run typecheck` | The directive requires strict TypeScript contracts; no TypeScript toolchain existed. Dev-only, no runtime payload. | Yes — remove the devDependency and the `typecheck` script |
| D2 | Contracts live in a new root `contracts/` directory | Not in the static build's copy list, so no contract source is published to students and no build step was added | Yes — relocate |
| D3 | Gate 2B ships **types only**; no bundler and no runtime integration | Keeps every lab page unchanged and avoids an unauthorized build-pipeline change | Yes |
| D4 | Coverage plan stored at `data/architecture/lab-domain-coverage.json` | Avoids the `*-lmf-runtime.json` glob and the registered-schema file list, so no existing verifier changes behaviour | Yes |
| D5 | Starting-System v2.0.0 is a standalone template, not an edit to v1.0.0 | Published template versions are immutable; v1.0.0 remains byte-identical and still validates | Yes |
| D6 | The v2 template is **not** added to the static build's explicit template list | Gate 2B must not change any lab page; publication is a later, separately approved change | Yes |
| D7 | Two high-resistance scenarios carry **no** expected numeric values | The template declares no resistance magnitude for them, and no value may be invented | Yes, once a magnitude is declared and validated |
| D8 | `FAULT_OPEN_COIL` added to the v2 fault catalogue | An open coil must de-energise the contact; without it the coupling rule cannot be exercised | Yes |

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | TypeScript 7 is a major-version toolchain; behaviour could differ from TS 5 expectations | Low | Medium | Compiler runs clean under `strict`, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`; version pinned exactly |
| R2 | Contract drift between `contracts/*.ts` and the JSON schemas | Medium | Medium | A contract test asserts every required interface exists; schemas are validated in the same suite |
| R3 | Fixture values could be internally consistent yet physically wrong | Low | High | KCL at every node and power balance are asserted independently of any solver; ngspice decks must match the template's declared values exactly |
| R4 | The Gate 2C translator could be written to satisfy the expected netlist rather than the template | Medium | High | The expected netlist is hand-authored and independent; a deliberate single-element mutation must fail translation while numerical tests still pass |
| R5 | A solver could be validated against its own expectations | Medium | High | T1 hand calculations, T2a hand-authored ngspice decks and T2b translation tests are separate; no expectation is derived from the implementation |
| R6 | Deferred high-resistance scenarios could be forgotten | Low | Medium | They are present in the fixture with an explicit `reason`, and a test asserts they exist and explain themselves |
| R7 | Instrument accuracy could be fabricated | Low | High | `instrumentAccuracy` is `null` where no applicable source exists, with a stated reason |
| R8 | Domain engines could proliferate without a shared contract | Medium | Medium | One adapter contract, one failure taxonomy, one provenance shape; the coverage plan declares domain ownership |
| R9 | The coverage plan could be mistaken for evidence of readiness | Medium | High | The plan declares no engine as validated and states explicitly that it is not evidence of readiness |

## Gate 2C acceptance criteria (proposed)

| # | Criterion |
| --- | --- |
| C1 | Electrical MNA engine solves the v2.0.0 netlist and reproduces every value in the expected-values fixture within the declared tolerances |
| C2 | The engine reproduces the four declared diagnostic signatures and the open-coil unavailable state |
| C3 | Hand-authored ngspice decks agree with the engine for all five scenarios |
| C4 | A deliberate single-element translation mutation fails the translation tests while numerical tests still pass |
| C5 | Residuals are enforced; `residuals` is `null` for every failure that produced no valid solution |
| C6 | The three failure axes are individually reachable and mutually exclusive |
| C7 | Branch currents are derived from element laws only; a request without a resolvable branch returns `UNMEASURABLE_QUANTITY` |
| C8 | An opened ideal conductor splits its node; both resulting sides remain determinate unless genuinely unreferenced |
| C9 | The relay coupling resolves by fixed-point iteration and fails closed; an open coil or open control de-energises the contact |
| C10 | The 500 A fixed-current reference is applied only at the matched test condition; a simulated cranking current yields `not_comparable` |
| C11 | The engine runs in a Web Worker; timeouts, cancellation, and worker-unavailable paths are distinct from numerical failures |
| C12 | No lab route changes, and no write occurs to `attempts`, `attempt_answers`, or `scenario_questions` |

## Preservation evidence

- The original checkout `F:\TorqueMind` was not modified at any point.
- The GPU Laboratory repository was not accessed.
- The canonical LMF registry was not modified.
- Assessment eligibility, publication approval, and production routes are
  unchanged.
- No commit, push, merge, pull request, deployment, or database migration was
  performed.
