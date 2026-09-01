# TTED-805 Production Readiness Checklist

## Scope

This checklist verifies the evidence-backed assessment functionality currently authorized for production.

It does not declare the entire Gate 4 workstream complete. The no-crank scenario remains intentionally fail-closed until replacement evidence with verified reuse rights is approved.

## Authoritative evidence contract

| Scenario | Approved questions | Gate status |
|---|---:|---|
| `charging-system` | 3 | Passed |
| `no-crank` | 0 | Blocked and fail-closed |
| IJERT | 0 | Excluded and audit-recorded |

## Supabase infrastructure

- Supabase Preview is `ACTIVE_HEALTHY`.
- Preview deployment reached `FUNCTIONS_DEPLOYED`.
- All 28 expected migration versions were recognized.
- Fresh-database migration replay completed.
- Safe seed completed without inserting assessment questions, answer keys, evidence, or approvals.
- `citation_validations` remains restricted from direct public access.
- Ownership-based RLS redesign remains outstanding and must be completed in a dedicated security PR.

No manual SQL Editor migration is required for the migrations merged through PR #387.

## Evidence-policy verification

- Frontiers evidence is retained for `charging-system`.
- Three charging-system questions remain validated.
- IJERT PDF and instructional excerpts were removed.
- IJERT rejection metadata was retained without restricted excerpts.
- Daimler, GM, Ford, and Fluke sources remain excluded from instructional use.
- No-crank returns no questions when no policy-compliant evidence is approved.

## API verification

- `GET /api/scenario-questions-approved?scenario_id=charging-system` returns HTTP 200.
- Charging-system response contains exactly 3 questions.
- `GET /api/scenario-questions-approved?scenario_id=no-crank` returns HTTP 200.
- No-crank response contains exactly 0 questions.
- Neither response contains `correct_answer`.
- No server error details or privileged database fields are exposed.

## Assessment security

- Grading remains server-authoritative.
- Correct answers are absent from browser state, HTML attributes, and public API payloads.
- Unauthenticated assessment attempts are rejected.
- Cross-user access is rejected.
- Assessment mode does not expose tutor explanations.
- Training mode follows the approved feedback contract.

## Test and build verification

- `npm test` exits successfully.
- Supabase native contract tests pass.
- TTED-805 Playwright tests pass.
- `npm run docs:mermaid` renders all required diagrams.
- `npm run build` exits successfully.
- GitHub required checks pass for the exact commit being deployed.

Use exit codes and the current CI report as authoritative. Historical test totals in older reports must not be used as deployment gates.

## Gate interpretation

### Charging-system

Production readiness passes when:

- exactly 3 approved questions are returned;
- all required provenance and citation validations are present;
- no answer keys are exposed; and
- automated tests pass.

### No-crank

Current readiness passes only as a fail-closed security condition when:

- exactly 0 approved questions are returned;
- the UI does not manufacture or substitute questions;
- the API returns no answer keys; and
- the application clearly handles the unavailable assessment state.

Zero no-crank questions must not be "fixed" by approving unverified evidence.

## Remaining blockers

- Identify no-crank sources with verified redistribution or reuse rights.
- Create evidence chunks without exceeding the approved license scope.
- Generate replacement questions.
- Complete technical and instructional human review.
- Validate answer and explanation citations deterministically.
- Approve and deploy the replacement set through the normal migration and review process.
- Implement ownership-based RLS through a dedicated security migration.

## Sign-off

Production scope approved:

- Charging-system evidence path
- No-crank fail-closed behavior
- Answer-key security
- Required CI checks

Full Gate 4 completion:

- Not yet achieved because no-crank has no approved question set
