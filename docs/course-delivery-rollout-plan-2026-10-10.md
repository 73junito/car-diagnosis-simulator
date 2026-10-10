# Phase 7F-B Course Delivery Rollout Plan

## Purpose

Phase 7F-B selects the first course-delivery build sequence from the verified Phase 7F-A baseline. It is a **planning phase only**. No course is marked built, production-ready, assessment-eligible, or academically active by this plan.

## Batch 001 — Foundations

The first delivery-build batch is:

| Course | Title | Existing lesson plan | Prerequisite |
| --- | --- | --- | --- |
| AUT 101 | Introduction to Automotive Technology | `ug-aut101-foundations` | None |
| AUT 105 | Automotive Safety and Professional Practices | `ug-aut105-safety-professional-practice` | None |
| AUT 110 | Automotive Mathematics | `ug-aut110-automotive-math` | None |
| AUT 115 | Automotive Measurement and Instrumentation | `ug-aut115-measurement-instrumentation` | AUT 110 |

All four have canonical catalog-development mappings. AUT-115's only prerequisite is AUT-110, which is inside the same batch. This makes Batch 001 self-contained and suitable for the first repeatable page-build pattern.

## Batch 002 — Foundation extension

After Batch 001 is built and verified, the next queued set is:

- AUT 130 — Engine Systems I
- AUT 131 — Engine Systems I Laboratory
- AUT 160 — Manual Transmissions and Drivetrain Systems
- AUT 180 — Automotive Technical Documentation and Service Information

These courses already have canonical lesson mappings and depend only on Batch 001 or another course in Batch 002.

## Deferred mapping blockers

The rollout audit found courses that should **not** enter a delivery-build batch yet:

- **AUT 120 — Automotive Electrical Systems I:** no canonical catalog-development mapping is currently recorded.
- **AUT 150 — Steering, Suspension, and Wheel Alignment:** no canonical catalog-development mapping is currently recorded.

AUT-120 also blocks the coherent electrical sequence because AUT-121 requires concurrent AUT-120, while AUT-140 and AUT-170 list AUT-120 as a prerequisite.

These are curriculum-mapping blockers, not reasons to fabricate delivery pages.

## Build acceptance criteria

A course can move from planned rollout to a verified built-page state only after:

1. `exam-site/courses/<course-id>/index.html` exists.
2. Its canonical catalog-to-lesson mapping and referenced lesson plan both exist.
3. Prerequisites match the planning catalog.
4. The page remains instructional/formative and does not imply assessment authorization.
5. Accessibility and navigation checks pass.
6. Governed references are rendered from curriculum data rather than copied ad hoc.
7. The Phase 7F delivery baseline is updated only after the page exists and is verified.
8. Academic/content status is not changed merely because a delivery page was built.

## Governance boundary

Phase 7F-B builds **zero** new course pages and changes **zero** academic status or assessment-eligibility fields.

The assessment hold remains unchanged. This plan does not authorize scoring, grading, high-stakes use, accreditation, Kansas Board of Regents approval, academic-credit authority, or institutional adoption.
