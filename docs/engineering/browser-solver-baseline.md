# Browser Solver Baseline

Status: verified repository baseline
Recorded: 2026-10-20
Gate: 2A (isolated repository preparation)

## Purpose

This record establishes the measured repository baseline that the browser-native
laboratory re-engineering programme starts from. It records what the repository
currently proves, and it replaces an earlier baseline figure that was never under
version control.

It is a repository baseline. It is not evidence that a browser-native numerical
solver exists, is accurate, or is correct.

## Repository identity

| Item | Value |
| --- | --- |
| Original checkout | `F:\TorqueMind` at `d007287ab90efe7f67d7e7b4bdbe179fe144b2a4` (branch `feature/protection-rules-main-asset-promotion-review`) |
| Isolated worktree | `F:\TorqueMind-gate2` at `000690f57d3c1f0165479f7b47b93d543518eaf2` (branch `feature/lab-platform-gate2`, tracking `origin/main`) |
| Remote | `https://github.com/73junito/car-diagnosis-simulator.git` |
| Remote `main` at recording time | `000690f57d3c1f0165479f7b47b93d543518eaf2` (verified with `git ls-remote origin main` at execution time) |

The original checkout was verified unchanged after the isolated worktree was
created: `HEAD` remained `d007287a…` and the working-tree entry list remained
identical (same 25 entries, identical status hash).

## Environment

| Item | Value |
| --- | --- |
| Node | v22.23.1 (package `engines` requires `>=22.19.0`) |
| npm | 10.9.8 |
| Dependency install | `npm ci` from the committed lockfile; 857 packages |

## Jest baseline (isolated worktree)

Measured by `npm test` in `F:\TorqueMind-gate2`.

| Metric | Value |
| --- | --- |
| Test suites passed | 492 |
| Test suites skipped | 1 |
| Test suites total | 493 |
| Tests passed | 2717 |
| Tests skipped | 20 |
| Tests total | 2737 |
| Failures | 0 |
| Duration | 81.913 s |
| Test files collected | 494 |
| Suites collected from sibling worktrees | 0 |

## Supabase contract baseline

```text
node --test supabase/tests/security-contracts.test.js supabase/tests/package-integrity.test.js
```

| Metric | Value |
| --- | --- |
| Tests | 15 |
| Passed | 14 |
| Failed | 0 |
| Todo | 1 |

## Laboratory Management Framework and engineering validation

All commands below exited 0 in the isolated worktree.

| Command | Result |
| --- | --- |
| `npm run validate:lmf-foundation` | PASS — 17 labs (7 existing, 10 planned); 13 engineering adapters; 11 shared diagnostic tools; 24 measurement types; 26 fault classes plus 5 legacy circuit fault mappings; 20 governed scenario-to-lab mappings; authority boundary intact |
| `npm run validate:lmf-runtime-coverage` | PASS — 7 of 7 existing labs projected; 10 planned labs intentionally unprojected |
| `npm run validate:engineering-artifacts` | PASS — 8 artifacts |
| `npm run validate:circuits` | PASS — 1 circuit; generic training boundary preserved |
| `node scripts/verify-engineering-parameters.js` | PASS — 3 generic training profiles, 3 lab training profiles, 50 authoritative specifications across 2 catalogs |
| 7 per-lab runtime verifiers | PASS — starting-system, relay-load, sensor, actuator, network, multivoltage, circuit |

## Canonical LMF inventory

| Item | Count |
| --- | --- |
| `data/lmf/` source contracts | 7 (`README.md`, `lab-registry.json`, `scenario-lab-mappings.json`, `engineering-model-adapters.json`, `diagnostic-tools.json`, `measurement-contract.json`, `fault-taxonomy.json`) |
| Implemented-lab runtime projections (`data/architecture/*-lmf-runtime.json`) | 7 |

## Test-discovery isolation

The repository root of the original checkout contains sibling git worktrees
checked out inside it. Because `testMatch` uses a `**/tests/**` glob, those
sibling copies were collected as duplicate, stale suites.

| Checkout | Test files collected | Suites from sibling worktrees |
| --- | --- | --- |
| Original `F:\TorqueMind` (unmodified collection) | 1251 | 878 |
| Original `F:\TorqueMind` (with exclusion pattern applied) | 373 | 0 |
| Isolated `F:\TorqueMind-gate2` | 494 | 0 |

Exclusion added to `jest.config.js`:

```text
'^(.*)/wt-[^/]+/tests/'
```

Verification: applying the pattern to the original checkout's collection removed
exactly 878 paths, with 0 unexpected removals and 0 remaining worktree-origin
paths.

This is a test-discovery isolation correction only. No test assertion, reporter,
timeout, or CI requirement was changed. On the isolated worktree the pattern is
inert and purely defensive; the post-change suite count must remain 493.

## Known pre-existing dependency advisories

`npm ci` reports 19 moderate severity advisories. They are pre-existing and
unrelated to this programme.

- `npm audit fix --force` is prohibited by repository policy and was not used.
- The governed remediation path is `npm run validate:dependency-security-exceptions`.
- These advisories must be reviewed through that process before any production
  release.
- `husky install` also emits a deprecation warning from the `prepare` script;
  this is cosmetic and no action is proposed.

## Baseline correction record

The previously circulated figure of **103 Jest test suites and 507 Jest tests** is
**withdrawn**.

It was recorded in a locally excluded, unversioned file. `git check-ignore -v`
reports:

```text
.git/info/exclude:7:Agents.md	AGENTS.md
```

The file is therefore not part of the repository, is absent from `origin/main`,
and does not describe the measured repository state. The measured figures in this
document supersede it.

The locally excluded file was deliberately not modified.

## Evidence boundary

- This baseline describes the existing repository only.
- It is not evidence of browser-solver correctness, numerical accuracy, or
  engineering validity. No browser-native solver is present in this baseline.
- It is not a claim of instructional validation, assessment eligibility, or
  publication approval.
- Engineering behaviour of scenarios and laboratories remains governed by the
  existing engineering model adapters, evidence roles, and applicability rules.
- Assessment authority, publication authority, and production routes are
  unchanged.

## Reproduction

From the isolated worktree root:

```text
npm ci
npm test
npm run validate:lmf-foundation
npm run validate:lmf-runtime-coverage
npm run validate:engineering-artifacts
npm run validate:circuits
node scripts/verify-engineering-parameters.js
```

## Next boundary

Gate 2B establishes the browser solver's typed contracts and independently
validated starting-system fixtures, without introducing the numerical
implementation.
