# Phase 7F-E Mapping Blocker Reconciliation and Batch 003 Plan

## Finding

The delivery audit identified **14 planning-catalog records without canonical catalog-development mappings**. AUT 120 and AUT 150 remain the priority blockers because they sit directly in the undergraduate prerequisite graph.

The repository does contain legacy/common-course evidence for both subjects, but that evidence is not enough to declare the planning-catalog courses canonically covered.

### AUT 120 — Automotive Electrical Systems I

Existing legacy/common-course evidence points to:

- `AAS-AUT-120` — Electrical I
- existing course: `electrical-1`
- existing lesson: `ug-electrical-charging-system`

That lesson focuses on **charging-system evidence and diagnostic decisions**. AUT 120 is broader: electrical fundamentals, voltage/current/resistance, circuits, wiring, relays, fuses, grounding, and electrical testing.

Therefore the legacy lesson is a useful crosswalk, but it is **not treated as canonical AUT 120 course coverage**.

### AUT 150 — Steering, Suspension, and Wheel Alignment

Existing legacy/common-course evidence points to:

- `AAS-AUT-140` — Suspension & Steering I
- existing course: `suspension-steering-1`
- existing lesson: `ug-suspension-steering-foundations`

The current canonical development table is identity-preserving: every canonical mapping uses the same planning-catalog ID and existing course ID. AUT 150 has no such canonical record.

Therefore AUT 150 also remains blocked until a dedicated canonical mapping/content decision is made.

## Batch 003 — planned

The next safe delivery-build batch is:

| Course | Title | Prerequisite disposition |
| --- | --- | --- |
| AUT 200 | Engine Systems II | AUT 130 already built |
| AUT 201 | Engine Systems II Laboratory | Concurrent AUT 200 in same batch |
| AUT 220 | Automatic Transmissions and Transaxles | AUT 160 already built |

Each of these courses already has an identity-preserving `canonical-catalog-course` mapping and an existing governed lesson plan.

## Governance

Phase 7F-E is planning/audit only:

- no new course page is created;
- no academic/content status changes;
- no assessment eligibility changes;
- no scored/high-stakes authorization;
- no legacy crosswalk is promoted to canonical coverage merely to unblock page delivery.

The correct next build step after this plan is **Phase 7F-F — Batch 003 Course Page Build**.
