---
name: rala-architecture
description: Design or review offline-first, agent-enhanced learning applications using the Resilient Agent Learning Architecture. Use for service workers, local data, synchronization, agent boundaries, Cloudflare architecture, cross-application reuse, or architecture decisions involving TorqueMind or Village Strong.
license: MIT
compatibility: Intended for repositories using browser applications and optionally Cloudflare Workers or Agents SDK.
metadata:
  author: TorqueMind and Village Strong
  version: "0.1.0"
---

# RALA architecture skill

1. Identify the user workflow and whether it must work offline.
2. Identify authoritative state and the deterministic component that owns it.
3. Identify what an agent may recommend versus execute.
4. Define typed input and output contracts.
5. Define local persistence and synchronization behavior.
6. Define failure, retry, conflict, approval, and observability behavior.
7. Add tests before broadening autonomy.

Keep the service worker deterministic. It may cache, queue, retry, synchronize, and provide fallbacks. Do not place diagnostic, educational, eligibility, grading, or safety reasoning in it.

Do not force both applications into one codebase. Share contracts, skills, test patterns, and proven packages while keeping domain models and user experiences separate.
