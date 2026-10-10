# Phase 7F-D Course Delivery Rollout Execution

## Purpose

Phase 7F-D executes Batch 002 after the verified Phase 7F-C Batch 001 build. AUT 130, AUT 131, AUT 160, and AUT 180 now have dedicated instructional course pages in addition to the four Batch 001 pages. Building these pages does **not** make the courses production-ready for assessment, assessment-eligible, or academically active.

## Batch 001 — Foundations — built and verified

The first delivery-build batch is:

| Course | Title | Existing lesson plan | Prerequisite |
| --- | --- | --- | --- |
| AUT 101 | Introduction to Automotive Technology | `ug-aut101-foundations` | None |
| AUT 105 | Automotive Safety and Professional Practices | `ug-aut105-safety-professional-practice` | None |
| AUT 110 | Automotive Mathematics | `ug-aut110-automotive-math` | None |
| AUT 115 | Automotive Measurement and Instrumentation | `ug-aut115-measurement-instrumentation` | AUT 110 |

All four have canonical catalog-development mappings. AUT-115's only prerequisite is AUT-110, which is inside the same batch. Phase 7F-C has now built and verified the four dedicated course pages, with catalog navigation and non-assessment boundaries.

## Batch 002 — Foundation extension — built and verified

Phase 7F-D has built and verified:

- AUT 130 — Engine Systems I
- AUT 131 — Engine Systems I Laboratory
- AUT 160 — Manual Transmissions and Drivetrain Systems
- AUT 180 — Automotive Technical Documentation and Service Information

These courses have canonical lesson mappings and depend only on Batch 001 or another course in Batch 002. AUT 131 preserves its concurrent-enrollment relationship with AUT 130.

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

Phase 7F-D builds **four additional** dedicated instructional course pages (eight catalog-aligned pages total) and changes **zero** academic status or assessment-eligibility fields.

The assessment hold remains unchanged. This plan does not authorize scoring, grading, high-stakes use, accreditation, Kansas Board of Regents approval, academic-credit authority, or institutional adoption.
