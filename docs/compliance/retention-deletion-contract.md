# AutoLearn Pro Retention and Deletion Contract

Status: P0.3 governance baseline
Verified: 2026-09-29
Change type: documentation/governance/validation only

## Purpose

This contract defines retention and deletion rules for student-related data identified in the Student Data Inventory and external processing identified in the Subprocessor Register.

This contract does not execute deletion, alter database foreign keys, change provider settings, or authorize destructive production actions.

## Governing principles

1. Data is retained only for a documented product, educational, security, contractual, or legal purpose.
2. No student-related data may be retained indefinitely merely because storage is available.
3. A school-district deletion request for covered Kansas student information must be completed within a reasonable period unless the student or parent/legal guardian requests continued maintenance.
4. When COPPA applies, child personal information is retained only as long as reasonably necessary for the specific purpose for which it was collected and is securely deleted when that purpose ends or deletion is validly requested.
5. The project operational target for ordinary account closure is completion within 30 calendar days, subject to validated legal/security hold exceptions.
6. Institution-controlled education records require an institution-approved retention configuration before institutional onboarding at scale.
7. Primary-store deletion does not equal complete deletion until downstream exports, derived records, provider copies, and applicable backups are addressed.
8. Backups may not be restored in a way that silently resurrects data already subject to a completed deletion request.
9. Authentication secrets use the shortest practical lifetime and are not archived as student records.
10. Unknown or legacy data remains frozen from new use until its retention/disposition is approved.

## Retention classes

| Class | Applies to | Retention rule | Deletion trigger |
| --- | --- | --- | --- |
| R01 session_ephemeral | authentication sessions, temporary browser attempt context | shortest practical session lifetime; no archival use | sign-out, session expiry, security revocation, or account closure |
| R02 account_lifecycle | profile/email/role and account-linked preferences needed to operate an account | while account is active and purpose remains valid | validated account-closure request; operational completion target 30 calendar days |
| R03 institution_controlled | rosters, enrollments, classes, institution-managed roles | institution-configured; no indefinite default | institution request, contract end, valid student/parent request where applicable, or configured schedule |
| R04 assessment_record | attempts, assigned questions, submitted answers, scores/completion records | institution-configured for institutional deployments; purpose-bound for direct users | institution request, account closure where no overriding lawful/contractual need exists, or configured schedule |
| R05 telemetry_minimized | user/session-linked telemetry | 30-day logical TTL for approved telemetry; physical purge automation remains separately gated | TTL expiry, account/institution deletion request where linkable, or purpose termination |
| R06 ai_transient | tutor prompt/response content | no application archival by default; downstream retention must be verified and approved | request completion plus provider/gateway deletion or expiry according to approved terms |
| R07 legacy_frozen | review_required legacy tables/views/exports | no new use; retain only until disposition review establishes lawful purpose or deletion plan | approved migrate/archive/delete decision |
| R08 security_legal_hold | narrowly scoped records required for incident response, fraud/security investigation, litigation preservation, or other legal duty | only for documented hold scope and duration | hold release or legal requirement expiration |

## Asset mapping

| Inventory asset | Retention class | Current contract state |
| --- | --- | --- |
| SDI-001 Supabase Auth + profiles | R01 + R02 | 30-day account-closure target; provider backup/log behavior still requires account-level verification |
| SDI-002 attempts | R04 | institution-configurable retention required before institutional scale |
| SDI-003 attempt_answers | R04 | follows parent attempt/student deletion scope unless a documented hold applies |
| SDI-004 attempt_questions | R04 | linkage record follows parent attempt deletion scope |
| SDI-005 telemetry_events | R05 | P0.4 establishes a 30-day logical TTL and allowlisted public payload contract; physical purge automation remains deferred |
| SDI-006 AI tutor request transit | R06 | application should not persist prompt/response merely for convenience; gateway/downstream retention remains review-required |
| SDI-007 browser/session storage | R01 | clear on sign-out/session expiry where technically applicable |
| SDI-008 instructor analytics aggregation | R04 or deidentified aggregate | identifiable source follows underlying student records; truly deidentified aggregate may be retained separately only after deidentification review |
| SDI-009 completions/replays | R04 + R07 | active ownership/use review required before retention automation |
| SDI-L01 question_attempts | R07 | retired from production and verified absent on 2026-09-30; canonical progress data remains in governed active stores |
| SDI-L02 transcripts/summary | R03/R04 + R07 | frozen pending institution-record determination |
| SDI-L03 student_recommendations | R04 + R07 | retired and verified absent on 2026-09-30 after current physical-backup verification and guarded production migration; authenticated empty boundary remains until a governed neutral model exists |
| SDI-L04 roster/classroom model | R03 + R07 | empty legacy roster shells retired and verified absent on 2026-09-30; `enrollments` and `classes` remain governed/frozen pending institution-model approval and separate class-row review |

## Deletion request lifecycle

1. **Authenticate the requester.** Determine whether the request comes from the student, parent/legal guardian where applicable, institution/school district, or an authorized administrator.
2. **Determine scope.** Identify account, tenant/institution, student identifiers, affected assets, exports, and subprocessors.
3. **Check exceptions.** Any security/legal hold must be specific, documented, minimally scoped, and time-bounded. A generic desire to keep data is not a hold.
4. **Restrict further processing.** Where feasible, stop nonessential use while deletion is pending.
5. **Delete primary records.** Remove or irreversibly de-identify covered records according to referential dependencies and approved procedures.
6. **Delete/expire downstream copies.** Cover exports, cached artifacts, analytics copies, and approved subprocessors.
7. **Handle backups safely.** If immediate physical purge is unavailable, ensure deleted records remain unavailable in ordinary operation and are not resurrected by restore; reapply deletion upon restore where needed.
8. **Record completion evidence.** Keep only a minimal deletion audit record that proves request handling without recreating the deleted content.
9. **Notify requester/institution.** Confirm completion or document the narrow lawful reason for any retained subset.

## Internal service targets

These are project operating targets, not statements that every law imposes the same deadline.

| Event | Internal target |
| --- | --- |
| Ordinary direct-user account closure | Complete covered active-data deletion within 30 calendar days |
| Kansas school-district deletion request | Complete as soon as practicable and within the project's 30-calendar-day target unless a narrower institutional contract requires faster action |
| Parent/guardian COPPA deletion request | Promptly restrict further collection/use where required and complete deletion within the project's 30-calendar-day target, subject only to a valid narrow exception |
| Security credential revocation | Immediate or near-immediate logical revocation |
| Provider/subprocessor deletion request | Initiate promptly after validated primary request; track through provider-confirmed completion or documented provider expiry mechanism |

The 30-calendar-day target is an internal ceiling for normal workflows, not permission to delay a request that can reasonably be completed sooner.

## Special rules

### Kansas educational deployments

Kansas law requires covered operators to delete student information within a reasonable period after a school-district request unless the student or parent/legal guardian requests continued maintenance. The product must therefore support district-scoped deletion and must not require closure of an unrelated institution account merely to delete one student's covered information.

### Under-13 / COPPA deployments

Before under-13 deployment, the product must have:
- a written child-data retention schedule tied to each collection purpose;
- parent/school notice reflecting the retention policy where required;
- a verified parent/school deletion path;
- cessation of further collection/use when legally required;
- secure disposal procedures;
- age-verification data retained only as long as needed for age verification.

### Assessment records

Assessment integrity does not create an unlimited retention right. Institutions may need records for academic, accreditation, dispute, or audit purposes, but those needs must be documented in the institution retention configuration. Answer keys and question-bank content are separate content assets and are not deleted merely because a student's response record is deleted.

### Deidentified aggregates

Aggregates may be retained outside the student deletion lifecycle only if:
- the data cannot reasonably be linked back to a student;
- direct identifiers and unnecessary linkable identifiers have been removed;
- no hidden join key is retained that would readily re-identify the student;
- re-identification is prohibited by policy;
- the transformation is documented and testable.

### Legal/security holds

A hold must contain:
- hold ID;
- authority/reason;
- affected asset IDs;
- start date;
- owner;
- review date or end condition.

The hold must preserve only the minimum records necessary. When released, the normal deletion request resumes.

## Provider responsibilities

### Cloudflare

Request/log retention settings must be documented at the account level. Student content must not be intentionally copied into optional logs or analytics beyond what is operationally necessary.

### Supabase

Deletion design must cover Auth plus linked database rows. Backups, logs, PITR, and exports must be reviewed at the production-account level before automated deletion is declared complete.

### AI gateway / downstream model provider

R06 requires no application-side prompt archive by default. Before institutional student data is permitted, gateway and downstream provider retention must be verified. If a provider cannot meet the approved retention/deletion contract, student-data routing to that provider remains disabled.

## Implementation gates

No production deletion automation may be merged until:
- referential dependencies are tested against a disposable database;
- dry-run/report mode exists;
- deletion scope is tenant/student-specific;
- legal/security hold checks fail closed;
- deletion audit evidence is minimized;
- backup/restore behavior is documented;
- subprocessor deletion steps are included;
- destructive production execution requires explicit authorized action.

## Official legal sources

- Kansas K.S.A. 72-6333: https://www.kslegislature.gov/b2025_26/laws/072_000_0000_chapter/072_063_0000_article/072_063_0033_section/072_063_0033_k/
- FTC COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC COPPA compliance plan: https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business

## Next retention implementation

P0.4 establishes the allowlisted telemetry payload contract and 30-day logical TTL. Physical purge automation remains a separate implementation that must satisfy the destructive-operation gates in this contract before production use.
