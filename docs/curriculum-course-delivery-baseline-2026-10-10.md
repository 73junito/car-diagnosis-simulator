# Phase 7F-A Course Delivery Status Baseline

**Verified baseline:** current repository `main` after PR #819  
**Purpose:** separate curriculum/reference coverage from actual dedicated course delivery pages.

## Verified counts

| Measure | Current state |
| --- | ---: |
| Planning-catalog courses | 68 |
| Catalog records marked planned | 68 |
| Lesson plans | 64 |
| Undergraduate lesson plans | 43 |
| Graduate lesson plans | 21 |
| Dedicated course delivery pages | 1 |
| Catalog courses without a dedicated course page | 67 |

The only dedicated course page currently present under `exam-site/courses/<course-id>/index.html` is:

- `aut-250`

## Status-model finding

The existing academic/content `status` field cannot be treated as delivery status.

`undergraduate-courses.json` contains one record marked `active`:

- `electrical-1`

There is no corresponding dedicated `exam-site/courses/electrical-1/index.html` page. Conversely, AUT-250 has a dedicated delivery page while the planning catalog still records AUT-250 as `planned`.

Therefore Phase 7F-A keeps the existing academic/content statuses unchanged and establishes a separate delivery-evidence rule:

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

At this baseline, there is **1 dedicated course delivery page: AUT-250**.

## Governance boundary

This baseline does not:

- change any existing course or pathway `status`;
- make another course active;
- create a syllabus or course page;
- authorize assessment question display;
- authorize scoring or grading;
- authorize high-stakes use; or
- establish institutional approval, accreditation, or academic-credit authority.

The next delivery rollout should use this baseline as the source of truth before a course is promoted to any future delivery-ready state.
