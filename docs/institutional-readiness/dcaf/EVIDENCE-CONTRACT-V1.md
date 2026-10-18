# DCAF v1.0 — Diagnostic Evidence Contract and Instructor Review

**Status:** proposal for formative-only simulation evidence. This is not a credentialing instrument, verified student identity, validated competency score, production grading endpoint, or authorized research collection pipeline. No research or institutional approval is implied.

## Interface

`contracts/diagnostic-evidence/evidence.schema.json` describes an export envelope with scenario ID/version, pseudonymous session ID, student alias, ordered event list, and SHA-256 checksum. `contracts/diagnostic-evidence/validate.js` checks core identity, event ordering, timestamp consistency, test/measurement pairs, simulator-origin claims, checksum and eligibility safeguards. Input is the unmodified output of `engine/aut250MisfireLab.js` `exportEvidence()`. The current mock student UI must NOT be treated as engine-equivalent until its event vocabulary, error states, fault truth, and scenario are technically reconciled in a separate integration PR.

The export checksum detects accidental changes but is **not an authenticated signature or verified origin**. The `simulated:true` marker is only a claim of provenance within the artifact; actual provenance needs an authenticated, trusted event producer and storage controls before instructor or research reliance. The schema and validator do not prove that a submitted diagnosis is correct, that evidence was gathered honestly, or that a student is competent.

## Observable behaviors and proposed DCAF mapping

| Dimension | Raw evidence to inspect | Human judgment needed |
|---|---|---|
| Diagnostic process (25) | Hypotheses and chronological test selections | Was the testing strategy coherent and adaptive? |
| Tests/measurements (25) | Instrument, test ID, simulated measurement with units/context | Were tests appropriate and interpreted accurately? |
| Technical reasoning (20) | Hypothesis changes, diagnosis and accompanying explanations | Does the conclusion follow from evidence? |
| Safety/procedures (10) | Explicit safe-operation evidence and instructor observations | Simulator does not presently capture enough to score safely |
| Repair verification (10) | Repair event, verification test and result | Does verification actually reproduce original fault conditions? |
| Documentation (10) | Explanation, measurement provenance, scenario version | Is the reasoning sufficiently reproducible? |

Weights are illustrative and must not be used as an automated diagnostic competency score. Record absent constructs as **not observed**, never as inferred zero skill. Test counts and duration must not be proxies for diagnostic competence.

## Instructor review specification

1. Confirm scenario identity, status, content validity, signed technical review and event-schema version.
2. Validate integrity and event sequence; quarantine inconsistent exports without changing the raw evidence.
3. Review plausible alternatives and justified testing strategies; record supporting event references and missing observations.
4. Independently rate anchored performance criteria when piloting reliability, with blind second rater and adjudication record (reviewer IDs, rubric versions, rationale, timestamps, disagreements).
5. Provide feedback separately from raw events, preserving the original export and instructor overrides in an append-only governed store **only after a separately reviewed privacy/security implementation**.
6. Make no eligibility, grade, certification, or scientific validation claim from this prototype. Human-subjects research needs the appropriate prior determination/authorization.

## Integration gate

Before connecting PR #1050 student UI to the engine: ensure mock `OL` secondary-circuit model is not silently treated as the engine's intermittent primary-coil fault; decide fault truth with two qualified SMEs, reconcile adapter signatures, and independently validate measurement assumptions. Contract tests must pass against the real engine fixture and later the approved frontend adapter. A later PR must address authenticated evidence provenance, privacy/access controls, accessibility, storage and pilot governance.

Run focused tests with `npx jest tests/institutional-pilot/diagnostic-evidence-contract.spec.js --runInBand` in an installed repository. No production integration is performed by this PR.
