# Hybrid Agentic Roadmap

**Status:** Stage 1 implemented; later stages gated by validation and human-controlled rollout.

## Product doctrine

The agentic layer may prepare diagnostic, instructional, engineering, governance, and release work, but it does not synthesize human approval or authority.

The Automotive Diagnostic Copilot is advisory-only. It may not:
- grade assessment work,
- approve evidence, rights, publication, or release,
- change assessment eligibility,
- publish curriculum or scenarios,
- execute privileged institutional/admin actions,
- replace technician verification.

Unknown capabilities, tools, agents, states, and transitions fail closed.

## Stage 1 — bounded diagnostic copilot and runtime hygiene — implemented

Implemented components:

- `src/ai/diagnostics/diagnostic-copilot.js`
  - bounded intents,
  - required-context checks,
  - evidence-gate enforcement,
  - deterministic next-action preparation,
  - explicit advisory-only authority boundary,
  - mode-aware response policy,
  - technician verification requirement.

- `src/ai/diagnostics/diagnostic-copilot-agent.js`
  - `diagnostic-plan-preparation`,
  - `diagnostic-report-preparation`,
  - no human-approval or release capability.

- Governance catalog registration
  - `diagnostic-copilot-agent` is preparation-only.

- Text/runtime hygiene
  - canonical `.gitattributes`,
  - canonical `.editorconfig`,
  - CI-backed text-normalization policy validation.

### Stage 1 activation status

The contracts are active in the shared AI module, but there is **no production browser/API activation yet**.

That is intentional. Stage 1 does not enable:
- production diagnostic session persistence,
- external LLM execution,
- autonomous tool execution,
- production Copilot API routes,
- user-facing Copilot UI.

## Stage 2 — diagnostic session persistence and bounded execution — next

Required before product activation:

1. Server-authoritative diagnostic session persistence.
2. Ownership/self-scope rules for user sessions.
3. Bounded tool execution contract with explicit allowlist.
4. Retry budget and timeout budget.
5. Idempotent execution/run identifiers.
6. Structured execution events and observable failure states.
7. Safe report persistence with provenance references.
8. Authenticated API boundary for plan/report preparation.

No tool may mutate vehicle truth, assessment truth, evidence approval, or institutional authority.

## Stage 3 — production activation and observability

1. Authenticated Copilot UI.
2. Model provider behind the deterministic contracts.
3. Model context excludes raw account identity and raw VIN by default.
4. Full request/run observability.
5. Cost/latency/error budgets.
6. Explicit production persistence health gate.
7. Kill switch / disabled-by-default runtime configuration.
8. Human verification UX before any diagnostic recommendation is treated as final.

## Stage 4 — broader agents

Only after the diagnostic Copilot execution path is stable:

- Student Coach agent augmentation.
- Instructor intelligence summaries.
- Engineering-maintenance agent workflow.
- Governed curriculum/evidence preparation agents.

These agents inherit the same rule: preparation is not approval, publication, eligibility, deployment, or release authority.
