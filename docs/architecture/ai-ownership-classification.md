# TorqueMind AI Ownership Classification

**Document ID:** ARCH-AI-001  
**Status:** Approved  
**Version:** 1.0  
**Last Updated:** 2026-07-28

---

# Purpose

This document defines the architectural ownership boundaries for every AI-related
component within the TorqueMind repository.

Its objectives are to:

- establish a single canonical AI runtime,
- separate product runtime from developer tooling,
- prevent architectural drift,
- simplify future maintenance,
- provide a reference for all future AI ADRs.

This document is the authoritative ownership reference for AI components.

---

# Guiding Principles

TorqueMind distinguishes **Product AI** from **Developer AI**.

## Product AI

Product AI executes as part of the application.

Characteristics include:

- participates in runtime
- executes user requests
- affects application behavior
- ships with the application
- covered by production tests

Examples:

- Scheduler
- Agent runtime
- Agent registry
- Domain agents
- Prompt execution
- Skills execution

---

## Developer AI

Developer AI exists only to assist repository development.

Characteristics include:

- code review
- repository analysis
- documentation generation
- local Ollama tooling
- GitHub automation
- embeddings
- search indexes

Developer AI is never imported into production runtime.

---

# Canonical Runtime

The only canonical runtime location is:

```text
src/ai/
```

No production AI logic should exist outside this directory.

---

# Runtime Architecture

```text
src/
└── ai/
    ├── index.js
    │
    ├── kernel/
    │   ├── scheduler-kernel.js
    │   └── agent-process.js
    │
    ├── runtime/
    │   └── ai-orchestrator.js
    │
    ├── registry/
    │   └── agent-registry.js
    │
    ├── events/
    │   └── runtime-event-bus.js
    │
    ├── agents/
    │
    ├── prompts/
    │
    └── skills/
```

This hierarchy represents the long-term product runtime.

---

# Ownership Matrix

| Path | Owner | Runtime | Decision |
| ------ | ------- | --------- | ---------- |
| `.ai/` | Developer Infrastructure | No | Keep separate |
| `.github/agents/` | Developer Infrastructure | No | Keep |
| `.github/skills/` | Developer Infrastructure | No | Keep |
| `.github/hooks/` | Developer Infrastructure | No | Keep |
| `.github/ollama/` | Developer Infrastructure | No | Keep |
| `tools/ai/` | Developer Infrastructure | No | Keep |
| `tools/ai-team/` | Developer Infrastructure | No | Keep |
| `prompts/` | Pending Review | No | Audit required |
| `skills/` | Pending Review | No | Audit required |
| `src/core/agents/` | Pending Review | Unknown | Audit required |
| `src/ai/` | Product Runtime | Yes | Canonical runtime |

---

# Runtime Responsibilities

## Kernel

Responsible for scheduling.

Includes:

- priority scheduling
- queue management
- concurrency
- lifecycle transitions
- quotas
- backpressure

Files:

```text
src/ai/kernel/
```

---

## Runtime

Responsible for orchestration.

Includes:

- request routing
- execution
- runtime context
- process creation

Files:

```text
src/ai/runtime/
```

---

## Registry

Responsible for discovering agents.

Includes:

- registration
- lookup
- capability resolution
- priority selection

Files:

```text
src/ai/registry/
```

---

## Events

Responsible for runtime communication.

Includes:

- lifecycle events
- telemetry hooks
- analytics hooks
- logging hooks

Files:

```text
src/ai/events/
```

---

## Agents

Responsible for business logic.

Examples:

- Diagnostics Agent
- Assessment Agent
- Instructor Agent
- Curriculum Agent

Files:

```text
src/ai/agents/
```

---

## Prompts

Contains reusable prompt templates.

No executable logic belongs here.

Files:

```text
src/ai/prompts/
```

---

## Skills

Contains reusable AI capabilities.

Examples:

- reasoning
- summarization
- diagnostics
- tutoring

Files:

```text
src/ai/skills/
```

---

# Architectural Boundaries

The Product Runtime MUST NOT directly import:

```text
.github/
.ai/
tools/
```

Specifically:

- `.github/hooks`
- `.github/agents`
- `.github/skills`
- `.github/ollama`
- `.ai`
- `tools/ai`
- `tools/ai-team`

Developer tooling may interact with runtime only through documented adapters or APIs.

---

# Public Runtime Entry Point

The canonical public entry point is:

```text
src/ai/index.js
```

No external module should import individual runtime components unless explicitly required.

---

# Migration History

The former experimental runtime existed under:

```text
ai-os/
```

The scheduler and process lifecycle implementation were promoted into:

```text
src/ai/kernel/
```

using Git history-preserving moves.

The previous location is retired.

---

# Current State

Current runtime includes:

- SchedulerKernel
- AgentProcess
- RuntimeEventBus
- AgentRegistry
- AIOrchestrator

The runtime foundation is complete.

No user-facing application features currently depend on this runtime.

---

# Future Expansion

Future work will introduce:

- Diagnostics Agent
- Instructor Agent
- Assessment Agent
- Curriculum Agent
- Tutor Agent
- Prompt Library
- Skill Library
- Memory Providers
- Model Providers

without changing the kernel architecture.

---

# Out of Scope

This document does not define:

- LLM providers
- Prompt engineering standards
- Security policy
- Authentication
- Authorization
- Telemetry persistence
- Distributed scheduling

These topics will be addressed by separate ADRs.

---

# Related Documents

- ADR-009 — AI Runtime Ownership
- ADR-010 — AI Kernel, Registry, and Orchestrator
- Future ADR — Runtime Providers
- Future ADR — Prompt Governance
- Future ADR — Agent Lifecycle

---

# Summary

The TorqueMind repository now maintains a clear architectural separation between:

- **Developer AI** — tooling that assists repository development.
- **Product AI** — runtime components that execute application behavior.

All future production AI functionality will be implemented under:

```text
src/ai/
```

Developer tooling will remain isolated under its existing directories and will not become a runtime dependency.

This separation establishes a stable, scalable foundation for future diagnostics, instructional, and assessment agents while preserving a clean architecture.
