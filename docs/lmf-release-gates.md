# AutoLearnPro LMF release gate policy (PR #1128)

Release decisions use reproducible evidence, not the average of maturity scores. The eight engineering categories (architecture, evidence provenance, security, solver correctness, test coverage, authentication, database integration, deployment operations) are qualitative review dimensions; numerical estimates **never override** required gates.

## Release criteria

- **P0 (blocking):** Auth unit and auth-aware smoke tests pass on the intended commit; invalid/expired credentials fail closed; canonical staging and production migration histories are reconciled without bypasses.
- **P1 (blocking):** Disposable-database tests prove tenant isolation, unauthorized-write rejection, atomic append under concurrency, verified key rotation and historical chain replay. Evidence names the disposable destination and model/solver versions. Independent non-author review and required GitHub checks pass.
- **P2 (operational):** Performance/load thresholds and measurements, observability signals/alerts, failure recovery, rollback rehearsal and runbook are recorded before a production rollout. Targets must be approved before the tests are run, not retroactively adjusted to obtain a pass.

All evidence must identify a commit SHA, run URL or immutable artifact, reviewer and timestamp. Re-run affected gates when implementation or schema changes. Do not authorize assessment eligibility, migration promotion, key retirement, retention purges, or solver execution merely by passing these gates; those remain separate explicit approvals.

## Machine-readable checklist

`data/lmf/release-evidence.json` tracks the gates. A gate has status `pending` or `passed`; only `passed` with a complete evidence link, full commit SHA and independent reviewer is accepted. Run `node scripts/check-lmf-release-gates.cjs` to validate the record. A nonzero exit is an expected **release hold**, not permission to disable the checker. CI must not be marked successful by adding stub evidence, self-approval or weakening the required gate set.

The checker documents a release decision; it does not itself prove the referenced tests ran or substitute for branch protection. Reviewers must inspect the linked run or artifact and verify that the commit and environment match.

## Eighteen-category robustness assessment

The machine-readable catalog at `data/lmf/robustness-catalog.json` contains 18 dimensions grouped into four domains: software engineering; security and data integrity; automotive and educational quality; and institutional operations. Each dimension has a priority, acceptance-test description, reviewer role, applicability and evidence state.

The catalog validator (`node scripts/check-lmf-robustness-catalog.cjs`) enforces completeness and rejects fabricated pass states. The catalog is deliberately initialized to `planned` / `not-evaluated`; this allows the organization to track work without pretending future functionality has been tested. P0 controls tied to currently deployed features should be activated and reviewed first; not-applicable determinations require an independent documented scope decision.

The **eight release gates** in `release-evidence.json` remain the mandatory release decision. The catalog adds assessment breadth but does not automatically replace release gates or authorize promotion. Existing authorization, multi-tenant and evidence-integrity checks must never be bypassed due to a high category score.

For controlled institutional rollout, review WCAG 2.2 AA accessibility, NIST AI RMF / Generative AI Profile grounding and uncertainty evaluation, and applicable 1EdTech LTI 1.3/LTI Advantage interoperability tests *when those product features are in scope*. Record the exact standards versions and test procedures in the linked evidence.

Cross-cutting resilience requirements include malformed and extreme inputs, failure recovery, concurrent access, performance/load, cryptographic key lifecycle, observability and regression resistance. Each applicable program must define quantitative thresholds before execution, preserve immutable artifacts and identify an independent reviewer. No average numerical score can override a failed mandatory release gate.
