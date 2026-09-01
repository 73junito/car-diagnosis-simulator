# No-Crank Evidence Workstream

**Branch**: `feat/no-crank-open-evidence`  
**Started**: 2026-09-01  
**Baseline Verified**: 2026-09-01 at HEAD commit `350a29a`

## 1. Current State Baseline

| Metric | Value |
|--------|-------|
| Scenario | `no-crank` |
| Status Code | 200 |
| Approved Questions | 0 |
| Answer Keys Exposed | No |
| Policy Compliance | ✓ Fail-closed |
| Database Writes | 0 (read-only baseline) |

**Baseline Endpoint**: `GET /api/scenario-questions-approved?scenario_id=no-crank`  
**Response Size**: 75 bytes (metadata only, no questions)  
**Verification Time**: 2026-09-01T16:25:00Z

### Baseline Payload
```json
{
  "scenario_id": "no-crank",
  "questions": {},
  "approved_questions": {},
  "count": 0
}
```

## 2. Source Research Requirements

**Acceptance Criteria for Sources**:
- ✓ Explicit CC BY license (text must state "CC BY" or "Creative Commons Attribution")
- ✓ Explicit CC BY-SA license
- ✓ Explicit CC0 (public domain dedication)
- ✓ Public domain (verified by authoritative source)
- ✓ Written redistribution permission (email/document from copyright holder)

**Rejection Criteria** (insufficient on their own):
- ✗ Google Scholar availability (search engine indexing)
- ✗ DOI or CrossRef access (publication directory)
- ✗ Freely downloadable PDF (no license stated)
- ✗ "Available for educational use" (no reuse right specified)
- ✗ Expired copyright without explicit public domain statement
- ✗ Author website with no explicit license

## 3. Sources Inventory

### Approved Sources
(To be populated with verified reuse rights)

| ID | Title | Author | License | Evidence | Status |
|---|---|---|---|---|---|
| (pending research) | | | | | |

### Under Review
(Sources being investigated)

### Rejected Sources
(Sources that do not meet acceptance criteria)

## 4. Question Generation Pipeline

1. Source selection (verified license only)
2. Excerpt preparation (cite source URL and specific section)
3. Question authoring (based on approved excerpt)
4. Answer verification (deterministic validation)
5. Citation record creation
6. Rollback-only simulation
7. Human review

## 5. Deployment Checklist

- [ ] Source research complete (verified licenses only)
- [ ] Questions generated from approved evidence
- [ ] Rollback-only simulation passed
- [ ] Citation validation completed
- [ ] Human review approved
- [ ] Answer keys secured (service-role-only)
- [ ] API deployment verified
- [ ] Fail-closed fallback tested
- [ ] RLS redesign deferred to separate PR
- [ ] Local artifacts reviewed separately

## 6. Guardrails

- **Zero approval-less data**: No questions ingested without explicit verified source license
- **Rollback-first testing**: Simulate failure modes before production deployment
- **Citation integrity**: Every question includes source evidence URL
- **Answer key security**: Never exposed via public API endpoints
- **Audit trail**: Complete record of source review and approval
- **Deferred security work**: RLS ownership redesign is a separate security PR

## 7. Progress Timeline

- **2026-09-01 16:25:00Z**: Baseline verified (fail-closed, 0 questions)
- **Pending**: Source research
- **Pending**: Question generation
- **Pending**: Deployment
