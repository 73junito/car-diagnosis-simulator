# Institutional Reviewer Checklist

Use this checklist to record an institution's review of the current AutoLearnPro readiness package.

## Review metadata

- Institution:
- Reviewer:
- Role/title:
- Review date:
- Proposed deployment:
- Learner population / age range:
- Jurisdiction(s):
- Intended use:
  - [ ] Non-assessment instruction
  - [ ] Formative practice
  - [ ] Workforce training
  - [ ] Postsecondary instruction
  - [ ] Secondary CTE
  - [ ] Other:
- Assessment use requested:
  - [ ] No
  - [ ] Yes — requires separate authorization review

## 1. Production architecture and availability

Evidence:
- `docs/releases/production-release-baseline-2026-10-09.md`
- `docs/releases/phase7a-production-baseline-monitor.md`

Review:
- [ ] Public, learner-app, and exam/prelaunch surfaces are understood.
- [ ] Daily production-baseline monitoring is acceptable.
- [ ] Required uptime/SLA terms are identified separately if needed.
- [ ] Institution-specific network/security requirements are documented.

Decision:
- [ ] Accepted
- [ ] Accepted with conditions
- [ ] Additional evidence required
- [ ] Not approved

Notes:

## 2. Curriculum and technical evidence

Evidence:
- `docs/curriculum-reference-quality-audit-2026-10-09.md`

Review:
- [ ] Reviewer understands that quantitative reference coverage is 64/64.
- [ ] Reviewer has reviewed the Phase 7C deterministic result: 64 strong, 0 solid, 0 review; direct-domain authority 64/64.
- [ ] Reviewer understands that the deterministic source-quality screen does not itself create institutional approval, accreditation, or academic-credit authority.
- [ ] Any institution-required textbook, standards, manufacturer, or local curriculum sources are identified separately.

Decision:
- [ ] Accepted for current non-assessment instructional use
- [ ] Accepted with conditions
- [ ] Additional evidence required
- [ ] Not approved

Notes:

## 3. Source rights and content reuse

Review:
- [ ] Source-specific rights controls are acceptable.
- [ ] Restricted sources remain citation/link-only where required.
- [ ] AI/RAG/storage/reproduction permissions are handled per source.
- [ ] Any institution-supplied content will undergo a separate rights review.

Decision:
- [ ] Accepted
- [ ] Accepted with conditions
- [ ] Additional evidence required
- [ ] Not approved

Notes:

## 4. Student privacy and data governance

Evidence:
- `docs/compliance/education-privacy-ai-control-matrix.md`
- `docs/compliance/student-data-inventory.md`
- `docs/compliance/student-data-inventory.json`
- `docs/compliance/retention-deletion-contract.md`
- `public-site/privacy.html`

Review:
- [ ] Institution's legal role and AutoLearnPro's service-provider role are defined.
- [ ] Student-data fields and purposes are acceptable.
- [ ] Retention/deletion requirements are documented.
- [ ] Required subprocessors and contract terms are reviewed.
- [ ] Learner age/COPPA implications are resolved where applicable.
- [ ] Jurisdiction-specific requirements are identified.
- [ ] No targeted advertising based on student information.
- [ ] No sale or rental of student information.
- [ ] Model training on identifiable institution-provided student records remains disabled unless separately authorized.

Decision:
- [ ] Accepted
- [ ] Accepted with conditions
- [ ] Additional evidence required
- [ ] Not approved

Notes:

## 5. AI governance

Evidence:
- `docs/compliance/education-privacy-ai-control-matrix.md`

Review:
- [ ] AI use is understood as instructional/advisory.
- [ ] AI output is not automatically treated as assessment evidence.
- [ ] Biometric identification remains disabled by default.
- [ ] AI pass/fail, credential eligibility, discipline, admission, and employment decisions remain disabled.
- [ ] Institution-specific disclosure/AI-use requirements are documented.

Decision:
- [ ] Accepted
- [ ] Accepted with conditions
- [ ] Additional evidence required
- [ ] Not approved

Notes:

## 6. Assessment governance

Review:
- [ ] Reviewer understands that assessment authorization is not part of this package.
- [ ] Scored assessment remains disabled for institutional/high-stakes use.
- [ ] Question-display unlock for governed assessment remains disabled.
- [ ] Any future assessment proposal will undergo separate item-level, legal, academic, fairness, accessibility, and human-review governance.

Decision:
- [ ] Current non-assessment posture accepted
- [ ] Additional evidence required
- [ ] Separate assessment review requested

Notes:

## 7. Accessibility

Evidence:
- `public-site/accessibility/index.html`

Review:
- [ ] Current accessibility design practices are reviewed.
- [ ] Institution-specific accessibility standard is identified.
- [ ] Formal conformance testing is requested if required.
- [ ] Accommodation workflow requirements are documented.

Decision:
- [ ] Accepted
- [ ] Accepted with conditions
- [ ] Additional evidence required
- [ ] Not approved

Notes:

## 8. Institutional conditions

List any required conditions before deployment:

1.
2.
3.


## 8A. Final-eight course governance decisions

Evidence:
- `data/curriculum/institutional-decision-package-final-eight.json`
- `docs/institutional-submission/Final-Eight-Institutional-Decision-Worksheet.md`

Review:
- [ ] Reviewer understands that all eight course decisions default to pending.
- [ ] Standing, placement, program/advisor approval, and advanced-course-selection decisions are made only by the identified institutional authority.
- [ ] No blank or incomplete decision unlocks a delivery page.
- [ ] Any approved decision will be recorded in repository governance evidence and followed by a deterministic re-audit before a new batch is defined.

Decision:
- [ ] Decision worksheet accepted for institutional use
- [ ] Accepted with conditions
- [ ] Additional evidence required
- [ ] Not approved

Notes:

## 9. Final institutional disposition

- [ ] Accepted for current non-assessment instructional use
- [ ] Accepted with conditions
- [ ] Additional evidence required
- [ ] Not approved for proposed use
- [ ] Separate assessment-authorization review required

Reviewer signature / approval reference:

Date:

## Important boundary

Completing this checklist does not by itself create accreditation, Kansas Board of Regents approval, academic-credit authority, assessment eligibility, or high-stakes assessment authorization. Those require the appropriate external and internal approvals for the proposed deployment.
