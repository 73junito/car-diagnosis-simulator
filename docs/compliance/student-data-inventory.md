# AutoLearn Pro Student Data Inventory and Classification

Status: P0 governance baseline
Source baseline: production schema + current application code
Verified: 2026-09-29
Change type: documentation/governance only

## Purpose

This register identifies student-related data AutoLearn Pro currently stores or processes, assigns a conservative classification, and records whether the processing path is confirmed active, transient, or requires legacy review.

This document does not authorize new collection or reuse. Unknown or schemaless payloads inherit the more restrictive classification until reviewed.

## Classification model

| Classification | Meaning | Minimum handling rule |
| --- | --- | --- |
| `authentication_secret` | Session tokens or credentials that can authorize access. | Never log or expose; shortest practical lifetime; secure client/server storage only. |
| `student_restricted` | Identified or linkable student education/activity data, including answers, scores, attempts, telemetry linked to a user/session, and AI tutor input. | Purpose-limited access; no targeted advertising, sale/rental, or unrelated model training; retention/deletion contract required. |
| `institution_record` | Institution-managed roster, class, enrollment, or role information. | Institution-controlled purpose, access, export, and deletion requirements. |
| `deidentified_aggregate` | Aggregate statistics that cannot reasonably be linked back to a student. | Re-identification prohibited; provenance of de-identification must be documented. |
| `public_content` | Curriculum/reference content not derived from a student's record. | Governed by source-rights controls rather than student-data controls. |
| `review_required` | Legacy, ambiguous, or schemaless data whose approved purpose/retention is not yet established. | No expansion of use; inventory and retention review required before new processing. |

## Active and transient data assets

| Asset ID | System / location | Data elements | Classification | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| SDI-001 | Supabase Auth + `public.profiles` | user UUID, email, role, account creation time | `student_restricted` + `institution_record` | Authentication, authorization, role routing | Confirmed active |
| SDI-002 | `public.attempts` | attempt UUID, user UUID, scenario, delivery/workflow mode, status, score, completion state, JSON payload, timestamps | `student_restricted` | Assessment/training attempt lifecycle | Confirmed active code path |
| SDI-003 | `public.attempt_answers` | attempt/question/user UUIDs, submitted answer, correctness, submission time | `student_restricted` | Server-side grading audit trail | Confirmed active code path |
| SDI-004 | `public.attempt_questions` | attempt/question linkage, sequence, assignment time | `student_restricted` | Bind approved questions to an assessment attempt | Confirmed active code path |
| SDI-005 | `public.telemetry_events` | session ID, optional user UUID, event type, allowlisted JSON payload, source, timestamp, logical expiry | `student_restricted` | Product/session telemetry and instructor session history | P0.4 allowlisted public ingress; 30-day logical TTL; physical purge deferred |
| SDI-006 | AI tutor request transit | scenario, question, student answer, topic, provider/model request metadata | `student_restricted` | Training-mode instructional feedback | Confirmed transient processing; blocked in official assessment mode |
| SDI-007 | Browser session/local storage | authentication session/token, assessment attempt ID, delivery mode | `authentication_secret` + `student_restricted` | Maintain authenticated session and attempt context | Confirmed active |
| SDI-008 | Instructor analytics aggregation | student/user identifier, session count, average score, average confidence when source report exists | `student_restricted`; aggregate output may qualify as `deidentified_aggregate` only after review | Instructor analytics | Code path exists; current local report file absent |
| SDI-009 | `public.completions` and `public.replays` | user UUID, scenario linkage, replay actions/results/confidence, timestamps | `student_restricted` + `review_required` | Historical completion/replay tracking | Production data exists; active application path not confirmed in this review |

## Legacy / review-required production assets

The following production structures contain student-linked records but were not confirmed as part of the current primary application flow during this review. Their presence does not constitute approval for expanded processing.

| Asset ID | System / location | Data elements | Classification | Required action |
| --- | --- | --- | --- | --- |
| SDI-L01 | `public.question_attempts` | historical student-linked answer data | `student_restricted` | Retired from production and verified absent on 2026-09-30; canonical progress remains on `attempts` + `attempt_answers`. |
| SDI-L02 | `public.student_transcripts` and summary view | student identifier, attempt/scenario counts, correctness counts, accuracy, average time, activity timestamps | `student_restricted` + `review_required` | Confirm whether this is institution-record output or legacy analytics. |
| SDI-L03 | `public.student_recommendations` | retired legacy recommendation records; production table verified absent | `student_restricted` + `review_required` | Retired and verified on 2026-09-30 after current physical-backup verification and guarded migration; authenticated endpoint remains empty pending a governed neutral model. |
| SDI-L04 | `public.students`, `public.student`, `public.enrollments`, `public.classes`, `public.schools` | names/identifiers, school/class relationships, roles, enrollment relationships, timestamps | `institution_record` + `student_restricted` + `review_required` | Confirm intended institution model and active consumers before onboarding institutional records. |

## Processing boundaries discovered in code

### Official assessment flow

The server verifies the authenticated user owns the attempt, retrieves the authoritative answer server-side, records the submitted answer and correctness in `attempt_answers`, and suppresses immediate correctness feedback during official assessment mode.

AI tutor assistance is explicitly rejected before provider access when the delivery mode is an official assessment or AI assistance is disabled.

### AI tutor flow

Training-mode tutor requests can transmit the student's free-text answer together with scenario/question context to the configured AI inference provider. Request logging records provider/model/host and request metadata, but the reviewed worker logger does not intentionally log the prompt or student answer.

This processing remains `student_restricted`. Provider-side retention, training, and logging terms are not established by this inventory and must be addressed in the subprocessor register before institution-supplied student records are sent to an external provider.

### Telemetry

`telemetry_events.payload_json` remains a JSONB column, but P0.4 now enforces an allowlisted schema at the public telemetry ingress. Telemetry remains `student_restricted` whenever a user/session can be linked to a student, and credentials, answer keys, unnecessary student text, biometric data, precise geolocation, and sensitive survey/health data remain prohibited.

## P0 rules established by this inventory

1. New student-related fields require an inventory entry before production use.
2. Schemaless JSON associated with a user/session inherits `student_restricted` unless a reviewed schema proves otherwise.
3. Identifiable student records must not be used for targeted advertising, sale/rental, or unrelated model training.
4. AI tutor requests containing student answers are student-data processing, even when no database row is created.
5. Official assessment content must not be sent to the tutor provider when AI assistance is disabled.
6. Authentication tokens are never telemetry and must never be copied into logs or analytics payloads.
7. Legacy/review-required assets must not be silently promoted into new product features.
8. Aggregation does not become de-identified merely because names are omitted; reasonable linkability must be evaluated.
9. Data deletion work must include relational/linkage records and downstream exports, not only the primary profile row.
10. Retention periods are currently a governance gap and must not be invented in code before the retention/deletion contract is approved.

## Gaps requiring the next P0 slices

### P0.2 — Subprocessor register

Record every external service that may receive student-related data, including purpose, data fields, transport, storage/retention, training use, jurisdiction, contractual controls, and deletion mechanism. The AI inference provider is the first priority because tutor prompts contain student answers.

### P0.3 — Retention/deletion contract

Define retention by asset class and deployment context, with institution-requested deletion, account closure, legal/security holds, backups, telemetry, exports, and legacy data explicitly covered.

### P0.4 — Telemetry payload contract — implemented

Public telemetry now uses an allowlisted event schema, prohibited-field controls, focused tests, and a 30-day logical TTL. Physical purge automation remains separately gated by the retention/deletion contract.

### P0.5 — Legacy disposition review

For each `review_required` production asset, identify its owner and current consumers, then choose retain/migrate/archive/delete through a separately reviewed change. No destructive database action is authorized by this document.

## Verification evidence

- Production Supabase schema inspected read-only on 2026-09-29.
- Current application code inspected for assessment creation/grading, tutor inference, telemetry storage, browser attempt/session state, and analytics aggregation.
- No production data was modified during this inventory.
- No runtime behavior is changed by this document.
