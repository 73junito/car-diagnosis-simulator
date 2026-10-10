# Phase 7F-H Course Delivery Status

**Current verified state:** Phase 7F-H Batch 004 graduate delivery implementation  
**Purpose:** separate curriculum/reference coverage from actual dedicated course delivery pages.

## Verified counts

| Measure | Current state |
| --- | ---: |
| Planning-catalog courses | 68 |
| Catalog records marked planned | 68 |
| Lesson plans | 64 |
| Undergraduate lesson plans | 43 |
| Graduate lesson plans | 21 |
| Dedicated course/training page directories | 15 |
| Catalog-aligned dedicated course pages | 14 |
| Catalog courses without a catalog-aligned dedicated course page | 54 |

The catalog-aligned dedicated course pages currently present are:

- `aut-101`
- `aut-105`
- `aut-110`
- `aut-115`
- `aut-130`
- `aut-131`
- `aut-160`
- `aut-180`
- `aut-200`
- `aut-201`
- `aut-220`
- `aut-501`
- `aut-515`
- `aut-590`

The existing `/courses/aut-250/` route is a separate HEV formative-training package crosswalked from catalog AUT-330. It is not the delivery page for catalog AUT-250 Automotive Diagnostics I.

## Status-model finding

The existing academic/content `status` field cannot be treated as delivery status.

`undergraduate-courses.json` contains one record marked `active`:

- `electrical-1`

There is no corresponding dedicated `exam-site/courses/electrical-1/index.html` page. Conversely, AUT-250 has a dedicated delivery page while the planning catalog still records AUT-250 as `planned`.

Phase 7F-H continues to keep the existing academic/content statuses unchanged and applies the same separate delivery-evidence rule:

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

At the current Phase 7F-H state, there are **14 catalog-aligned dedicated course pages: AUT-101, AUT-105, AUT-110, AUT-115, AUT-130, AUT-131, AUT-160, AUT-180, AUT-200, AUT-201, AUT-220, AUT-501, AUT-515, and AUT-590**, plus the separate **AUT-250 HEV training package crosswalked from AUT-330**.

## Governance boundary

This baseline does not:

- change any existing course or pathway `status`;
- make another course active;
- authorize assessment question display;
- authorize scoring or grading;
- authorize high-stakes use; or
- establish institutional approval, accreditation, or academic-credit authority.

The prior Phase 7F-C four-page catalog-aligned state is retained as `previousBaseline`; the original Phase 7F-A one-page state remains historically documented in `data/curriculum/course-delivery-status.json` as `previousBaseline`. The current delivery-status artifact is the source of truth for verified built pages.
