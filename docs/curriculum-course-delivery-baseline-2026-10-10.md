# Phase 7F-K Course Delivery Status

**Current verified state:** Phase 7F-K Batch 007 graduate advanced-systems delivery implementation
**Purpose:** separate curriculum/reference coverage from actual dedicated course delivery pages.

## Verified counts

| Measure | Current state |
| --- | ---: |
| Planning-catalog courses | 68 |
| Catalog records marked planned | 68 |
| Lesson plans | 64 |
| Undergraduate lesson plans | 43 |
| Graduate lesson plans | 21 |
| Dedicated course/training page directories | 28 |
| Catalog-aligned dedicated course pages | 27 |
| Catalog courses without a catalog-aligned dedicated course page | 41 |

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
- `aut-520`
- `aut-530`
- `aut-535`
- `aut-540`
- `aut-545`
- `aut-550`
- `aut-555`
- `aut-560`
- `aut-565`
- `aut-570`
- `aut-575`
- `aut-580`
- `aut-585`
- `aut-590`

The existing `/courses/aut-250/` route is a separate HEV formative-training package crosswalked from catalog AUT-330. It is not the delivery page for catalog AUT-250 Automotive Diagnostics I.

## Status-model finding

Academic/content status and delivery status remain separate. Building a dedicated page does not activate a course academically, establish learner prerequisite satisfaction, or authorize assessment.

Phase 7F-K retains the delivery-evidence rule:

- **planned** — no dedicated course delivery page is asserted;
- **page-built** — `exam-site/courses/<course-id>/index.html` exists;
- **production-ready** — reserved for a future explicit release decision and never inferred from page existence alone.

## Important interpretation boundary

The existing **64/64** curriculum metric means all 64 lesson plans satisfy the governed reference-coverage baseline. It does **not** mean 64 fully built online courses, completed syllabi, production-ready courses, or assessment-authorized courses.

At the current Phase 7F-K state, there are **27 catalog-aligned dedicated course pages**, plus the separate **AUT-250 HEV training package crosswalked from AUT-330**.

Graduate prerequisite determinations remain separate human or institutional decisions.

## Governance boundary

This baseline does not:

- change any existing course or pathway `status`;
- make another course active;
- automate admissions or prerequisite determinations;
- authorize assessment question display;
- authorize scoring or grading;
- authorize high-stakes use; or
- establish institutional approval, accreditation, or academic-credit authority.

The Phase 7F-J twenty-four-page catalog-aligned state is retained as `previousBaseline` in `data/curriculum/course-delivery-status.json`. The current delivery-status artifact is the source of truth for verified built pages.
