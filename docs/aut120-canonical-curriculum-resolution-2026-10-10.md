# Phase 7F-M AUT-120 Canonical Curriculum Resolution

## Resolution

AUT-120 — Automotive Electrical Systems I previously lacked identity-preserving canonical curriculum content. The historical `electrical-1` / `ug-electrical-charging-system` material remains useful legacy/common-course evidence but is narrower than the AUT-120 catalog scope and is not promoted or renamed.

Phase 7F-M creates a separate canonical AUT-120 development path:

- developed course: `aut-120`
- competency: `ug-aut120-electrical-fundamentals`
- lesson plan: `ug-aut120-electrical-fundamentals`
- catalog mapping: `aut-120 -> aut-120`
- mapping type: `canonical-catalog-course`
- expanded lesson content: dedicated AUT-120 fundamentals content
- database migration: `20261010174000_add_aut120_canonical_curriculum.sql`

## Instructional scope

The canonical lesson covers foundational voltage/current/resistance/power relationships, series/parallel circuit reasoning, power/protection/switch/load/ground roles, generalized wiring and component paths, measurement planning, voltage-drop evidence, and evidence-based electrical diagnosis.

Vehicle-specific wiring diagrams, procedures, specifications, limits, and safety information remain source-controlled and are not generalized into universal instructions.

## Reference posture

The migration maps two already-governed sources to the new lesson:

- Fiore AC Electrical Circuit Analysis — reference-only electrical theory
- Bosch alternator technical poster — citation-only automotive electrical-domain context

Existing source-rights restrictions remain unchanged. No source text, figures, database chunks, or RAG content are newly authorized.

## Development versus live baseline

Adding AUT-120 increases the repository development curriculum from 64 to **65** courses, competencies, lesson plans, and content plans. The previously recorded live production reference baseline of 64/64 remains historical evidence until the new migration is deployed and the live reference baseline is regenerated.

## Delivery result

Phase 7F-M does **not** build the AUT-120 course page. After the canonical resolution, the deterministic remaining-delivery audit identifies AUT-120 as the sole eligible **Batch 008** candidate.

## Governance

No academic/content status is promoted to active. No prerequisite is automatically satisfied. No assessment eligibility, scoring, grading, high-stakes use, institutional approval, accreditation, KBOR approval, or academic-credit authority is granted.
