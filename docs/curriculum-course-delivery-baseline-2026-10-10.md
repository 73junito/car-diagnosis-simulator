# Phase 7F-C Course Delivery Status

**Current verified state:** Phase 7F-C Batch 001 delivery implementation  
**Purpose:** separate curriculum/reference coverage from actual dedicated course delivery pages.

## Verified counts

| Measure | Current state |
| --- | ---: |
| Planning-catalog courses | 68 |
| Catalog records marked planned | 68 |
| Lesson plans | 64 |
| Undergraduate lesson plans | 43 |
| Graduate lesson plans | 21 |
| Dedicated course delivery pages | 5 |
| Catalog courses without a dedicated course page | 63 |

The dedicated course pages currently present under `exam-site/courses/<course-id>/index.html` are:

- `aut-101`
- `aut-105`
- `aut-110`
- `aut-115`
- `aut-250`

## Status-model finding

The existing academic/content `status` field cannot be treated as delivery status.

`undergraduate-courses.json` contains one record marked `active`:

- `electrical-1`

There is no corresponding dedicated `exam-site/courses/electrical-1/index.html` page. Conversely, AUT-250 has a dedicated delivery page while the planning catalog still records AUT-250 as `planned`.

Phase 7F-C continues to keep the existing academic/content statuses unchanged and applies the same separate delivery-evidence rule:

- **planned** — no dedicated course delivery page is asserted;
- **page-built** — `exam-site/courses/<course-id>/index.html` exists;
- **production-ready** — reserved for a future explicit release decision and never inferred from page existence alone.

## Important interpretation boundary

The existing **64/64** curriculum metric means all 64 lesson plans satisfy the governed reference-coverage baseline.

It does **not** mean:

- 64 fully built online courses;
- 64 completed course pages;
- 64 completed syllabi;
- 64 production-ready courses; or
- 64 assessment-authorized courses.

At the current Phase 7F-C state, there are **5 dedicated course delivery pages: AUT-101, AUT-105, AUT-110, AUT-115, and AUT-250**.

## Governance boundary

This baseline does not:

- change any existing course or pathway `status`;
- make another course active;
- authorize assessment question display;
- authorize scoring or grading;
- authorize high-stakes use; or
- establish institutional approval, accreditation, or academic-credit authority.

The Phase 7F-A one-page state remains recorded in `data/curriculum/course-delivery-status.json` as `previousBaseline`. The current delivery-status artifact is the source of truth for verified built pages.
