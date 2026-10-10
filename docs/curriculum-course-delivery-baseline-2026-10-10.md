# Phase 7F-K Course Delivery Status

**Current verified state:** Phase 7F-Y Batch 017 AUT-140/AUT-510/AUT-600 delivery implementation
**Purpose:** separate curriculum/reference coverage from actual dedicated course delivery pages.

## Verified counts

| Measure | Current state |
| --- | ---: |
| Planning-catalog courses | 68 |
| Catalog records marked planned | 68 |
| Developed lesson plans | 69 |
| Undergraduate developed lesson plans | 47 |
| Graduate lesson plans | 21 |
| Dedicated course/training page directories | 59 |
| Catalog-aligned dedicated course pages | 58 |
| Catalog courses without a catalog-aligned dedicated course page | 10 |

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

- **planned** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no dedicated course delivery page is asserted;
- **page-built** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â `exam-site/courses/<course-id>/index.html` exists;
- **production-ready** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â reserved for a future explicit release decision and never inferred from page existence alone.

## Important interpretation boundary

The previously verified live **64/64** curriculum-reference metric applies to the production baseline before the Phase 7F-M AUT-120 development addition. The repository now contains **69 developed lesson plans** after Phase 7F-Q. AUT-120, AUT-150, AUT-210, AUT-330, and AUT-525 canonical lessons carry governed reference mappings in migrations, but the historical live 64/64 evidence remains unchanged until deployment and baseline regeneration. Neither metric means fully built online courses, completed syllabi, production-ready courses, or assessment-authorized courses.

At the current Phase 7F-Y state, there are **58 catalog-aligned dedicated course pages**, plus the separate **AUT-250 HEV training package crosswalked from AUT-330**.

AUT-120 now has dedicated canonical development content and is the sole evidence-supported Batch 008 candidate; no AUT-120 delivery page is built by Phase 7F-M. Graduate prerequisite determinations remain separate human or institutional decisions.

## Governance boundary

This baseline does not:

- change any existing course or pathway `status`;
- make another course active;
- automate admissions or prerequisite determinations;
- authorize assessment question display;
- authorize scoring or grading;
- authorize high-stakes use; or
- establish institutional approval, accreditation, or academic-credit authority.

The Phase 7F-W fifty-five-page catalog-aligned state is retained as `previousBaseline` in `data/curriculum/course-delivery-status.json`. The current delivery-status artifact is the source of truth for verified built pages.

## AUT-250 route identity

Catalog AUT-250 Automotive Diagnostics I is delivered at `/courses/aut-250-diagnostics/`. The historical `/courses/aut-250/` route remains the legacy HEV formative-training package crosswalked from catalog AUT-330.

## AUT-330 route identity

Catalog AUT-330 Electric Vehicle Technology is delivered at `/courses/aut-330/`. The historical `/courses/aut-250/` HEV formative-training package remains preserved as related training and is not renamed.
