# AI Mechanic Assistant Architecture

**Document ID:** ARCH-AI-002
**Status:** Proposed canonical product architecture
**Runtime owner:** `src/ai/`

## Core rule

The LLM is a language, interpretation, synthesis, explanation, and orchestration component. It is **not** the source of truth, diagnostic database, safety authority, or vehicle-specification authority.

## Production architecture

```mermaid
flowchart TD
    U["Technician / Student"]
    UI["Web / Mobile UI"]
    API["Application API<br/>Auth • Authorization • Session"]
    SESSION["Diagnostic Session Store"]
    ORCH["AI Orchestrator<br/>Intent • Context • Tool Routing"]
    LLM["Ollama Provider<br/>Language • Interpretation • Synthesis"]
    VEHID["Vehicle Identity Resolver"]
    TOOLGW["Automotive Tool Gateway"]
    VPIC["NHTSA vPIC"]
    RECALL["NHTSA Recalls"]
    COMPLAINT["NHTSA Complaints"]
    VEHDB["Vehicle Configuration DB"]
    DTC["DTC / OBD-II Knowledge"]
    PARTS["Parts / Component Data"]
    RETRIEVE["Evidence Retrieval<br/>Hybrid Search + Reranking"]
    KB["Approved Technical Knowledge Base"]
    INGEST["Evidence Ingestion<br/>Rights • Hash • Normalize • Chunk • Metadata"]
    DOCS["Approved Technical Sources"]
    EVIDENCE["Evidence Gate<br/>Authority • Relevance • Vehicle Match • Sufficiency"]
    DIAG["Diagnostic State Engine<br/>Hypotheses • Tests • Evidence • Verification"]
    SAFETY["Safety + Verification Gate"]
    RESPONSE["Response Composer"]
    AUDIT["Audit / Provenance"]

    U --> UI
    UI --> API
    API --> SESSION
    API --> ORCH
    ORCH --> LLM
    ORCH --> VEHID
    ORCH --> TOOLGW
    ORCH --> RETRIEVE

    VEHID --> VPIC
    TOOLGW --> RECALL
    TOOLGW --> COMPLAINT
    TOOLGW --> VEHDB
    TOOLGW --> DTC
    TOOLGW --> PARTS

    DOCS --> INGEST
    INGEST --> KB
    KB --> RETRIEVE

    VPIC --> EVIDENCE
    RECALL --> EVIDENCE
    COMPLAINT --> EVIDENCE
    VEHDB --> EVIDENCE
    DTC --> EVIDENCE
    PARTS --> EVIDENCE
    RETRIEVE --> EVIDENCE

    EVIDENCE --> DIAG
    SESSION --> DIAG
    LLM --> DIAG
    DIAG --> SAFETY
    SAFETY --> RESPONSE
    LLM --> RESPONSE
    RESPONSE --> UI

    EVIDENCE --> AUDIT
    DIAG --> AUDIT
    SAFETY --> AUDIT
```

## Diagnostic flow

```mermaid
flowchart LR
    A["User / Vehicle Concern"] --> B["Vehicle Identity"]
    B --> C["Tool + Retrieval Requests"]
    C --> D["Normalized Evidence"]
    D --> E["Evidence Gate"]
    E -->|insufficient| F["Collect More Evidence"]
    E -->|supported| G["Diagnostic State Engine"]
    G --> H["Structured Diagnostic Decision"]
    H --> I["Safety / Verification Gate"]
    I --> J["Mode-Aware Response Composer"]
    J --> K["Technician / Student"]
```

## Trust boundaries

1. Raw external API payloads do not flow directly into the model. Tool adapters normalize them.
2. Retrieval and ingestion are separate. Only rights-reviewed, approved sources become retrievable context.
3. Vehicle-specific procedures and specifications require appropriate primary authoritative evidence.
4. A failed evidence gate returns an insufficient-evidence state instead of encouraging inference.
5. The model does not receive raw account identity. Raw VIN is excluded from model context by default.
6. Diagnostic decisions remain structured objects; prose is generated after evidence/safety evaluation.
7. Training and technician response policies are separate.
8. Technician verification is required before a diagnostic recommendation is treated as final.

## NHTSA boundary

Use separate adapters for:
- vPIC / VIN and manufacturer-reported vehicle identity,
- recall data,
- complaint data.

The vPIC API is rate controlled; a cache and, where appropriate, the downloadable VIN-decoding database can improve resilience. The standalone database is not a substitute for other vPIC API data.

## Implementation sequence

1. Vehicle identity resolver
2. Tool gateway and normalized result contracts
3. Evidence and provenance model
4. RAG ingestion/retrieval split
5. Diagnostic session/state engine
6. Ollama orchestration on top of the contracts
7. Safety/verification gate
8. Response/report UI
