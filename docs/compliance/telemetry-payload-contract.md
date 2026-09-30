# AutoLearn Pro Telemetry Payload Contract

Status: P0.4 implementation baseline
Verified: 2026-09-29
TTL: 30 days
Change type: privacy/runtime validation + database logical-expiry metadata

## Purpose

This contract limits student-linked telemetry to explicitly approved event shapes and establishes a 30-day logical retention boundary.

The 30-day TTL is an AutoLearn Pro data-minimization policy. It is not a claim that a statute requires exactly 30 days.

Physical deletion automation is intentionally not included in this change because the Retention and Deletion Contract requires separate authorization, dry-run evidence, dependency testing, hold checks, and backup/restore review before destructive production jobs are enabled.

## Public telemetry ingress

The public endpoint accepts only these top-level fields:

- `session_id`
- `event_type`
- `payload_json`

The client may not provide:

- `user_id`
- `source`
- `expires_at`
- authorization/session credentials
- arbitrary metadata fields

Unknown top-level fields fail closed.

## Approved event: scenario_started

Purpose: measure student-dashboard scenario navigation without collecting answers, grades, identity fields, or free-form student content.

Required:

- `session_id`: non-empty string, maximum 128 characters
- `event_type`: exactly `scenario_started`
- `payload_json.scenario_id`: finite number or non-empty string

Optional payload fields:

- `scenario_key`: string, maximum 128 characters
- `symptom_category`: string, maximum 256 characters

Every other payload field fails closed.

## Prohibited telemetry content

Telemetry must not contain:

- authentication secrets or authorization headers;
- student answers or answer keys;
- grades or scores;
- email addresses or student names;
- biometric identifiers;
- voice recordings or photos;
- precise geolocation;
- health/disability information;
- sensitive survey responses;
- AI prompts or generated responses.

A future event that needs any currently prohibited field requires a new privacy review and contract revision before implementation.

## Identity boundary

The client is not trusted to assert `user_id`. If authenticated user linkage is later required for an approved telemetry event, identity must be derived server-side from verified authentication context rather than accepted from the request body.

## Source boundary

The client cannot override telemetry `source`. The server normalizes accepted public events to the existing telemetry source.

## 30-day logical TTL

The production table gains `expires_at`:

```
expires_at = created_at + 30 days
```

Existing rows are backfilled using their original `created_at`, so old records become logically expired immediately when the migration is applied.

New records receive the 30-day expiry by database default.

Normal history/export reads filter out expired rows at the application layer. Rows without `expires_at` are temporarily treated as visible for deployment compatibility until the migration is applied.

## Why logical expiry precedes physical purge

P0.3 requires destructive retention automation to have:

- disposable-database dependency tests;
- dry-run/report mode;
- tenant/student scope;
- fail-closed legal/security hold checks;
- minimized deletion audit evidence;
- documented backup/restore behavior;
- subprocessor deletion steps;
- explicit authorization for production destruction.

P0.4 therefore establishes the retention boundary without bypassing those gates.

## Legacy telemetry

Production review found historical event types:

- `scenario_started`
- `manual_test`

`manual_test` is not approved for new public writes. Historical records are governed by the 30-day logical TTL after migration.

Internal server audit events, such as instructor-access audit events, are not authorized through the public telemetry endpoint and remain separate from this public-ingress contract.

## Implementation invariants

1. Unknown public event types fail closed.
2. Unexpected top-level fields fail closed.
3. Unexpected payload fields fail closed.
4. Public clients cannot assert user identity.
5. Public clients cannot override source or expiry.
6. Expired records do not appear in normal history/export.
7. The 30-day TTL is an internal minimization rule, not a statutory deadline claim.
8. Physical purge requires a separate authorized change.
9. This contract does not broaden assessment data collection.
10. This contract does not authorize AI prompt/response telemetry.

## Validation requirements

The implementation must verify:

- approved `scenario_started` payload succeeds;
- unknown event type fails;
- client `user_id` fails;
- unexpected payload content such as `student_answer` fails;
- invalid session IDs fail;
- expired database rows are filtered from reads;
- migration backfills `expires_at`;
- migration default is 30 days;
- migration contains no destructive delete/truncate or scheduled purge job.

## Supabase implementation note

Supabase documentation supports ordinary timestamp-based retention and scheduled deletion patterns, but the project intentionally defers scheduled deletion here. The production project currently has `pg_cron` available but not installed; enabling it is not necessary for this logical-expiry PR and would not be portable to the repository's plain PostgreSQL CI environment.

Relevant documentation:

- https://supabase.com/docs/guides/database/postgres/data-deletion
- https://supabase.com/docs/guides/cron/quickstart

## Next step

After this contract is merged and the migration is verified, the next retention implementation should be a separately authorized physical-purge design with dry-run evidence and legal/security hold support.
