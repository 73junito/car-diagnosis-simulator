# Hybrid Agentic Roadmap

**Status:** Stage 4 broader-agent expansion implemented, including Student Coach, Instructor Intelligence, Engineering Maintenance planning, governed curriculum preparation, and deterministic electrical diagnostic tooling. Consequential authority remains human-controlled.

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

## Stage 2 — diagnostic session persistence and bounded execution — implemented

Implemented:

1. Server-authoritative diagnostic sessions stored through the Worker service-role boundary.
2. Every Worker read/write is self-scoped to the authenticated user id.
3. Governed source chunks are resolved server-side; clients cannot self-declare source approval.
4. Vehicle-specific source authority remains fail-closed until a server-authoritative authority classifier exists.
5. Bounded tool executor with an explicit `circuit-engine` allowlist.
6. Retry ceiling of two attempts and timeout ceiling of five seconds.
7. User-scoped idempotency keys bound to session, operation, and deterministic input hash.
8. Structured execution lifecycle events.
9. Advisory report persistence with evidence chunk provenance references.
10. Authenticated `/api/copilot/sessions` plan/report preparation boundary.
11. RLS enabled on all Stage 2 tables with direct `anon` and `authenticated` access revoked.

Stage 2 still does not activate external model execution or a user-facing Copilot UI. No tool may mutate vehicle truth, assessment truth, evidence approval, or institutional authority.

## Stage 3 — production activation and observability — implemented, production default-off

Implemented:

1. Authenticated student Diagnostic Copilot workspace.
2. Model-provider adapter behind the deterministic Stage 1/2 planner.
3. Model context strips raw VIN and never includes authenticated account identity.
4. Provider output cannot choose the actionable next step; the API returns the deterministic planner's first allowed action.
5. Structured request/run logs for start, completion, duration, and failure type.
6. Provider timeout budget capped at 30 seconds and defaulted to 12 seconds.
7. Explicit persistence-health probe before provider execution.
8. Hard kill switch plus environment activation flag.
9. Preview and production configuration remain disabled by default.
10. Staging configuration is enabled for validation.
11. Human-facing verification reminder is always returned with model-assisted advice.
12. No grading, publication, release, credential, or assessment-eligibility authority is introduced.

Production activation requires an explicit configuration change after staging validation; merging this stage alone does not turn the production Copilot on.

## Stage 4 — broader agents — first expansion implemented

Implemented:

1. Student Coach agent
   - prepares practice summaries from existing server-generated training recommendations,
   - uses training data only,
   - does not use assessment results to make recommendations,
   - cannot grade, change eligibility, approve, or release.

2. Instructor Intelligence agent
   - prepares aggregate class training signals,
   - reuses existing instructor authorization and owned-class scoping,
   - excludes learner identity from the prepared intelligence output,
   - remains read-only and cannot grade, change eligibility, approve, or release.

3. Engineering Maintenance agent
   - prepares bounded maintenance plans for tests, documentation, dependency review, CI, or application code,
   - cannot commit, merge, deploy, or release,
   - requires human execution approval.

Additional Stage 4 implementation:

4. Governed Curriculum agent
   - validates curriculum enhancement drafts after provider generation,
   - accepts only approved, rights-cleared, non-assessment evidence,
   - preserves evidence/source provenance in a deterministic preparation envelope,
   - cannot approve evidence or rights, publish curriculum, enable assessment generation, or release content.

5. Deterministic diagnostic tool expansion
   - adds a read-only electrical measurement adapter for Ohm's law, voltage-drop percentage, and electrical power calculations,
   - expands the explicit bounded-tool allowlist only to `circuit-engine` and `electrical-measurement`,
   - never supplies vehicle specifications or diagnostic conclusions,
   - cannot mutate vehicle truth, evidence state, or assessment state.

Still deferred within Stage 4:

- any agent workflow that writes consequential state,
- autonomous tool selection beyond explicit deterministic allowlists,
- agent approval, publication, deployment, eligibility, or release authority.

All Stage 4 agents inherit the same rule: preparation is not approval, publication, eligibility, deployment, merge authority, or release authority.
