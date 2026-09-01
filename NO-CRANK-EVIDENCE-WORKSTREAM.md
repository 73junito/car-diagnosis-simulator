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

### Branch State at Creation
- **Branch**: `feat/no-crank-open-evidence`
- **Tracked files**: ✓ Clean (no uncommitted changes)
- **Working tree**: ⚠️ Unclean (170 untracked test/diagnostic artifacts present)
- **Branch head**: `350a29a` (PR #392 merged, documentation corrected)
- **Status**: Safe to proceed (tracked changes only matter for git operations)

## 2. Source Research Requirements

**Status**: Classification Complete (See NO-CRANK-SOURCE-RESEARCH.md)

**Verified License-Cleared Candidates**:
1. Wikibooks — Automobile Repair/Jump start (CC BY-SA, oldid=3997054)
2. Wikibooks — Automobile Mechanics (CC BY-SA, oldid=3251129)

**Verified Rejected Sources**:
1. NHTSA-hosted Kia no-crank bulletin (copyrighted, prohibited)
2. NHTSA-hosted Subaru document (manufacturer copyright, requires permission)
3. Other NHTSA manufacturer documents (require page-level review)

**Acceptance Criteria for Sources**:
- ✓ Explicit CC BY license (with attribution, license link, change disclosure)
- ✓ Explicit CC BY-SA license (with attribution, license link, ShareAlike compliance)
- ✓ Explicit CC0 (public domain dedication)
- ✓ Public domain (with authoritative proof)
- ✓ Written redistribution permission (email/document from copyright holder)
- ✗ Search engine availability (insufficient on its own)
- ✗ DOI or CrossRef access (insufficient on its own)
- ✗ Freely downloadable PDF (insufficient without license statement)
- ✗ "Available for educational use" (insufficient without reuse right)
- ✗ Manufacturer documents hosted by NHTSA (does not establish redistribution rights)

**CC BY-SA Compliance Requirements**:
- ✓ Attribution with source, page, and revision ID
- ✓ License link to creativecommons.org/licenses/by-sa/3.0/
- ✓ Change disclosure if content is adapted
- ✓ ShareAlike treatment (no mixing with proprietary corpus without segregation)
- ✗ Cannot silently blend into closed-source assessment database


## 4. Question Generation Pipeline

1. Source selection (verified license only)
2. Excerpt preparation (cite source URL and specific section)
3. Question authoring (based on approved excerpt)
4. Answer verification (deterministic validation)
5. Citation record creation
6. Rollback-only simulation
7. Human review

## 5. Workstream Status

**Phase 1: Research Framework ✓ COMPLETE**
- Commit `0216a87`: Research framework and source classification documented
- Framework-only status: No evidence decisions made, no questions approved
- Source classification: Based on publisher license verification (NHTSA, Wikibooks, manufacturer bulletins)

**Phase 2: Source Auditing (IN PROGRESS)**
- Task: Download and review approved Wikibooks pages
- Content: Battery voltage, starter operation, safety switches, clutch behavior
- Constraint: Generate questions only from verified excerpts

**Phase 3: Question Generation (PENDING)**
- Task: Author diagnostic questions from license-cleared candidates
- Constraint: Must include full source attribution and license statement
- Constraint: CC BY-SA requires explicit attribution chain

**Phase 4: Validation and Deployment (PENDING)**
- Rollback-only simulation
- Citation deterministic validation
- Human quality review
- API deployment and verification

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
- **2026-09-01 16:35:00Z**: Branch created, safety checks passed
- **2026-09-01 16:40:00Z**: Commit `0216a87` — Research framework established (no evidence approval)
- **2026-09-01**: Source classification complete — Wikibooks approved, NHTSA manufacturer docs rejected
- **Pending**: Question generation from approved Wikibooks sources
- **Pending**: Rollback-only simulation
- **Pending**: Deployment verification
