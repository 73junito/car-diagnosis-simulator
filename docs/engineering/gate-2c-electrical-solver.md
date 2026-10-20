# Gate 2C — Electrical Solver

Status: implemented and validated against hand calculations
Scope: browser-native Modified Nodal Analysis for the electrical domain

## Purpose

Implement the first domain-specific engine behind the Gate 2B contracts, without
laboratory routing, presentation, persistence, or assessment authority.

## Modules

| File | Responsibility |
| --- | --- |
| `src/simulation/netlist.ts` | template to validated netlist translation: conduction classification, ideal-node merging, node splitting, element models, battery internal node |
| `src/simulation/mna.ts` | connectivity partitioning, MNA assembly, scaled partial pivoting, residual verification, island handling |
| `src/simulation/electrical-adapter.ts` | fault resolution, relay fixed point, measurement derivation, `DomainAdapter` implementation |
| `src/simulation/engine.ts` | domain registry, `SimulationEngine`, orchestrator dispatch |
| `src/simulation/worker.ts` | worker protocol, main-thread client, timeout, cancellation, controlled fallback |
| `src/simulation/mna-worker.ts` | worker entry point and testable message handler |
| `scripts/build-simulation.js` | reproducible browser bundle with a credential scan |
| `scripts/jest-transform-ts.js` | esbuild-based TypeScript transform for Jest (no new dependency) |

## Translation rules implemented

- An **ideal conductor** merges its two terminals into one node.
- A conductor with a **declared resistance** becomes a resistive branch, so a
  voltage drop can be measured across it and both endpoints remain distinct.
- **Network and signal conductors are excluded** from the DC solve and reported
  with `physicalContinuity: 'galvanic'`. An excluded CAN conductor is never
  described as physically non-conductive.
- **PWM** is excluded until an equivalent-circuit model is declared.
- A **battery** contributes an ideal voltage source plus a series internal
  resistance, with a synthetic internal node between them.
- **Opening an ideal conductor splits the merged node**, because the merge is
  simply omitted. No special-case code is required for the split itself.
- A **DC path spanning two voltage systems** without a modelled converter is
  refused with `CROSS_DOMAIN_PATH`.
- Test-point identifiers resolve to nodes, so a laboratory can probe by test
  point rather than by terminal.

## Numerical method

```text
unknowns = (non-reference node voltages) + (one branch current per ideal voltage source)
G block  = conductances;  B/C blocks = source incidence;  D block = zeros
solve    = Gaussian elimination with row equilibration and scaled partial pivoting
validate = infinity norm of (A_original . x - b) against max(1e-9, 1e-9 * ||b||inf)
```

Failure stages are reported accurately: `assembly`, `factorization`, `solve`,
`validation`. `residuals` is `null` wherever no valid solution was produced and
is mandatory only at the `validation` stage. A residual is never synthesised to
satisfy a schema.

## Determinacy

Connectivity is determined from the **post-fault topology**:

- Nodes in the reference component have determinate absolute potentials.
- Nodes in an unreferenced island have an **indeterminate absolute potential**,
  reported as such. Their internal potential differences and currents are still
  determinate.
- A sourceless island carries exactly **zero** current and zero internal
  potential difference. These are proved results, not assumptions.

An open branch therefore does **not** make its downstream voltages unavailable.
In the pilot, both sides of an opened motor feed remain determinate: the
solenoid output reads battery voltage and the motor side is a proved zero.

## Relay coupling

The contact state is an **output** of the solve, derived from the solved coil
voltage by a bounded fixed point (maximum four iterations). The operating-state
flag is never used to hold the contact closed.

| Case | Resolution basis | Coil voltage |
| --- | --- | --- |
| Coil above pickup | `coil-voltage-above-pickup` | reported |
| Coil below hold | `coil-voltage-below-hold` | reported |
| Inside the hysteresis band | `hysteresis-retain` | reported |
| Coil element absent | `coil-element-absent` | **`null`**, never zero |
| Non-convergence | `RELAY_STATE_UNRESOLVED` | no value returned |

## Verification status

| Tier | Method | Status |
| --- | --- | --- |
| T1 | Hand calculations | **Passed** — all 11 node voltages and 12 branch currents across 5 scenarios |
| T2a | External ngspice execution | **Passed** — the ngspice-47 console executable ran all five hand-authored decks (exit 0). Every node voltage and element current agrees with both the browser solver and the hand calculation (voltage tolerance 1e-4 V, current tolerance 1e-3 A). Source-current sign convention and delivered current also agree. |
| T2b | Translation against a hand-authored expected netlist | **Passed** |
| T2c | Real Chromium browser worker | **Passed** — the built bundle starts a real Web Worker, solves, and matches the independent fixture; timeout, cancellation, fallback, resource limit and disposal are all correct; no runtime, CSP or bundle errors |
| T5 | Power balance | **Passed** — resistive dissipation equals source delivery |
| T6 | Determinism | **Passed** — repeated translation and repeated solve are byte-identical |

ngspice is located through `TORQUEMIND_NGSPICE_CONSOLE`, then the known per-user
install path, then PATH. If it is absent the comparison suite is skipped and the
gap is reported; no internally generated value is ever substituted for it.

## Measured performance

| Metric | Measured | Proposed budget |
| --- | --- | --- |
| Pilot translate + solve, p50 | 0.136 ms | — |
| Pilot translate + solve, p95 | 0.181 ms | <= 50 ms |
| Pilot translate + solve, maximum | 1.994 ms | <= 500 ms |
| Pilot network size | 11 nodes, 12 elements, 11 unknowns | <= 40 nodes for fallback |
| Worker bundle, raw | 58 322 bytes (dual-role) | within the 120 KB gzipped budget |
| **Real browser: init (first round trip)** | **14.6 ms** | not previously budgeted |
| **Real browser: solve p50 / p95 / max** | **0.30 / 0.40 / 0.50 ms** | <= 100 ms p95 interaction |
| **Real browser: JS heap delta after 25 solves** | **0.00 MB** (Chromium coarse measure) | <= 25 MB incremental |

Measured on the development machine in Chromium via Playwright. Absolute figures
vary by device; the budgets are asserted in the test suite and the numbers are
recorded as evidence rather than as a guarantee. The heap figure is a coarse
Chromium-only measure (`performance.memory`).

## Browser build

```text
npm run build:simulation         # writes dist-simulation/mna-worker.js
npm run verify:simulation-bundle # rebuilds and fails on drift
```

The bundle is a self-contained IIFE with no dynamic imports, no environment
access, and no server credentials. A test asserts the absence of
`SUPABASE_SERVICE_ROLE_KEY`, `SERVICE_ROLE`, `process.env` and `dotenv`, and
asserts that two builds are byte-identical. `dist-simulation/` is not tracked.

## Known limitations

1. **Low-end device performance is unmeasured.** The browser figures above come
   from a development machine; a 4x CPU-throttled profile has not been run.
2. **Graded resistance faults are refused.** `FAULT_HIGH_RES_POWER` and
   `FAULT_HIGH_RES_GROUND` declare no magnitude, so the engine refuses with
   `TOPOLOGY_UNSUPPORTED` rather than inventing a value.
3. **`UNDERDETERMINED_SYSTEM` is declared but not emitted.** The dense solver
   reports `SINGULAR_MATRIX` for both singular and rank-deficient systems, which
   is the grouping the owner's correction specified.
4. **Display resolution is a project convention** (three decimals). Driving it
   from `delco-diagnostic-voltmeter-resolution` requires the instrument layer.
5. **`resistance-between` and `waveform`** measurement kinds are declared in the
   contract but not implemented by the electrical engine; both return a declared
   refusal. An engine-level refusal takes precedence over an instrument
   capability refusal, so the more specific reason is reported.
6. **Cancellation is cooperative.** A superseded request resolves immediately on
   the main thread; the worker's in-flight computation is discarded on receipt.
7. **No residual for a non-finite candidate.** When a candidate vector contains a
   non-finite value no meaningful residual exists, so `null` is reported together
   with the offending index.
8. **The v2 template is not published.** It is deliberately absent from the
   static build's explicit template list, so no laboratory page changed.
9. **Contact-state wording.** A de-energized or unresolved coil leaves the
   normally-open main contact **electrically OPEN**. The template records this as
   `failureBehaviour: "de-energized-contact-open"`; the earlier
   `"fail-closed-contact-open"` value was ambiguous because "fail-closed" can be
   misread as an electrically closed contact, and a test now guards against it.
   "Fail closed" remains correct terminology for the repository's *governance*
   contracts, which are a different concern.

## Gate 3 prerequisites

1. Declare fault magnitudes for the graded resistance faults, with independent
   validation, before those scenarios can carry expected values.
2. Integrate the solver into the Starting-System laboratory behind a feature
   flag, with the production route unchanged until release approval.
3. Decide whether the instrument layer, the coupled mechanical domain and the
   500 A carbon-pile reference belong to Gate 3 or a later gate. They remain
   out of scope here.

External ngspice agreement (T2a) is no longer a prerequisite: it is complete.
