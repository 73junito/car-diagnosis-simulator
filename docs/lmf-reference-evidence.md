# Headless LMF reference evidence and replay

`src/simulation/lmf-reference-evidence.ts` captures a request and its outcome from the Starting-System v2 reference bridge and re-executes the same request to compare the result, including the available solver/model provenance and refusal state.

This is **in-memory, training-reference-only evidence**. It has no user identity, storage, cryptographic authentication, trusted timestamp, replay authorization, retention policy, or assessment authority. A match establishes identical serialized reference outcomes for the supplied model and request; it does not prove external provenance or protection against coordinated tampering. Do not expose this module as a graded or production evidence service.

Next gates: enforce runtime model-content digest checking; validate a persisted event schema; define server-side authorization, replay limits and retention; test against independently verified solver results; and obtain separate assessment/governance approvals.
