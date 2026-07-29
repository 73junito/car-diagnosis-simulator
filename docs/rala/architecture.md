# RALA Reference Architecture

## Boundary rule

The service worker is an infrastructure component, not an autonomous reasoning agent.

It may cache, queue, retry, synchronize, provide fallbacks, and emit structured telemetry. It must not grade learners, change permissions, invent domain facts, select diagnoses or interventions, or allow an LLM response to mutate authoritative state without validation.

## Decision authority

| Concern | Authoritative component |
|---|---|
| Authentication and authorization | deterministic application/backend |
| Assessment score | deterministic rubric/scoring engine |
| Safety constraints | deterministic policy engine |
| Agent suggestions | agent runtime |
| Offline delivery | service worker and local data layer |
| Conflict resolution | sync policy plus human review when required |

## Shared runtime contracts

Every domain application should map its data into `LearningEvent`, `AgentRecommendation`, `OfflineMutation`, `SyncReceipt`, and `PolicyDecision` concepts.
