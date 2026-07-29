---
name: agent-governance
description: Define, implement, or review AI-agent roles, permissions, structured outputs, human approvals, audit trails, safety boundaries, prompt or skill provenance, and evaluation requirements in RALA applications.
license: MIT
metadata:
  author: TorqueMind and Village Strong
  version: "0.1.0"
---

# Agent governance skill

An agent must not become the hidden source of truth.

Every agent definition must state purpose, allowed inputs, allowed tools, structured output schema, prohibited actions, authority level, approval requirements, timeout and retry policy, audit fields, and evaluation criteria.

Authority levels: `observe`, `recommend`, `prepare`, `execute-low-risk`, and `execute-approved`. Default to `recommend`.
