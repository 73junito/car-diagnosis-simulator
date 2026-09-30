# AutoLearn Pro Legacy Student-Data Disposition Review

Status: P0.5 governance baseline
Verified: 2026-09-29
Change type: documentation/governance/validation only

## Purpose

This review determines the safe disposition path for production student-related assets previously marked `review_required`.

No production data is deleted, archived, migrated, or rewritten by this change. Destructive actions remain separately gated by the Retention and Deletion Contract.

## Disposition vocabulary

| Disposition | Meaning |
| --- | --- |
| `retain_active` | Current use is confirmed and governed. |
| `migrate_then_retire` | Current code still depends on the asset; replace the dependency before retirement. |
| `delete_after_verification` | No active application dependency is confirmed; delete only after a final consumer/export check and approved destructive runbook. |
| `retain_schema_clean_rows` | Preserve the schema/authorization surface, but review orphaned production rows for cleanup. |
| `retire_empty_schema` | Empty legacy table can be retired after dependency and migration-history review. |
| `retired_verified` | Production object/data retired through an approved migration and verified absent afterward. |
| `blocked` | A dependency, legal/security hold, branding conflict, or unresolved ownership prevents disposition. |

## Production evidence summary

| Asset | Production rows | Active code dependency | Key dependency / risk | Disposition |
| --- | ---: | --- | --- | --- |
| `question_attempts` | 0 | No current application dependency | Retired from production on 2026-09-30; all 80 historical anonymous rows and dependent legacy views removed by the approved guarded migration | `retired_verified` |
| `student_transcripts` | 1 | No direct application reference found | Single identified/linkable transcript row | `delete_after_verification` |
| `student_recommendations` | 0 | No active table read after production deployment | Retired from production after verified physical backup and guarded migration; authenticated endpoint remains empty until a governed neutral model exists | `retired_verified` |
| `students` | 0 | No current application reference found | Retired from production after zero-row/dependency verification; classroom schema remains separate | `retired_verified` |
| `student` | 0 | No current application reference found | Retired from production after zero-row/dependency verification | `retired_verified` |
| `enrollments` | 0 | No runtime application reference found; authorization tests exist | Intended classroom authorization surface | `retain_schema_clean_rows` |
| `schools` | 0 | No current application reference found | Retired from production after child-table retirement removed the legacy roster dependency | `retired_verified` |
| `classes` | 2,206 | No runtime application reference found; authorization tests exist | All rows belong to one owner; no enrollments, students, assignments, or scenario assignments reference them | `retain_schema_clean_rows` |

## Detailed findings

### question_attempts

All 80 production rows are tagged `anonymous`, but the table contains submitted answers, authoritative answers, correctness, elapsed time, and scenario/question linkage.

The P0.5 baseline found two dashboard summary views derived from `question_attempts`.

The progress-migration follow-up replaces both direct view reads with an authenticated server API backed by canonical `attempts` and `attempt_answers`. Both canonical queries are scoped to the verified user ID. Student identifiers and the unsupported legacy timing metric are not returned to the browser. The guarded database migration revokes anonymous/authenticated access to the two legacy summary views without recreating them in fresh environments.

Disposition — complete:
1. the authenticated canonical progress API remains active;
2. repository/runtime/export scans and a 24-hour Supabase log review found no current consumer before retirement;
3. the approved guarded migration removed the 80-row anonymous legacy table and its verified dependent view chain on 2026-09-30;
4. post-migration verification confirmed the legacy table and former dashboard views are absent while canonical `attempts` and `attempt_answers` remain present.

### student_transcripts

The table contains one identified/linkable row.

Verification completed on 2026-09-30:
1. repository runtime/export search found no current consumer of `public.student_transcripts`;
2. the active transcript UI/API uses the canonical authenticated student-progress path instead;
3. a 24-hour Supabase log review found no observed `student_transcripts` access;
4. the table has no incoming foreign-key references and no dependent views.

Deletion remains blocked by governance, not by application dependencies:
1. the retention contract classifies this legacy asset under R03/R04 + R07 and freezes it pending institution-record determination;
2. production backup/restore behavior has not yet been verified through the available project tooling;
3. no destructive production deletion is authorized until both gates are satisfied.

When both gates clear, delete through the approved guarded runbook and preserve only minimal deletion evidence, not transcript content.

### student_recommendations

All six current rows use the anonymous student marker. The P0.5 baseline found an anonymous SELECT policy with an unconditional predicate and a direct student-dashboard REST dependency.

The access-migration follow-up replaced direct browser access with an authenticated server-controlled endpoint and revoked anonymous/authenticated table privileges.

Retirement review completed on 2026-09-30:
1. all six rows are anonymous;
2. no dependent views, user triggers, stored-routine consumers, or incoming foreign keys were found;
3. recent Supabase logs showed no runtime table access beyond migration activity;
4. all six scenario IDs remain recognizable training scenarios, but none has a governed neutral competency/curriculum mapping in the production database;
5. preserving the historical ranking would therefore preserve unsupported taxonomy semantics.

Implementation decision:
- the authenticated recommendation endpoint keeps its response contract but returns an empty recommendation list;
- the endpoint no longer reads `public.student_recommendations`;
- recommendation generation remains disabled until a governed neutral model exists;
- a fail-closed `DROP TABLE ... RESTRICT` retirement migration is prepared with exact row/anonymity and dependency guards;
- a production transaction-only dry run successfully dropped the table, verified absence, rolled back, and restored all six rows;
- production deployment is verified on the merged production Worker version `1d0ce846-b8b0-4f11-ac2e-f346294c52c9`;
- the production project is on the Supabase Pro plan, whose documented behavior provides automatic daily physical backups with 7-day retention and restore support;
- a current physical backup at `2026-09-30 08:27:39 UTC` was verified in the Supabase Backups dashboard with an available Restore action;
- the guarded retirement migration was applied to production and `public.student_recommendations` is verified absent;
- production migration history records versions `20260930175711` and `20260930191704` with the same retirement migration name; the second execution is a safe idempotent no-op because the migration returns immediately when the table is already absent;
- the recommendation asset is now `retired_verified`.

No public legacy recommendation access or assessment-eligibility effect is authorized.

### students / student / schools

Retirement completed on 2026-09-30:
1. local repository inspection found no active Supabase client, REST, or runtime consumer for the three legacy roster shells;
2. production verification confirmed all three tables contained zero rows;
3. no incoming foreign keys, dependent views, user triggers, stored-routine consumers, or publication memberships blocked retirement;
4. the only legacy foreign keys were outgoing from `students` to `classes` and `schools`;
5. a transaction-only production dry run dropped all three tables with `RESTRICT`, verified `enrollments` and `classes` remained present, rolled back, and restored all three target tables;
6. the guarded retirement was then executed permanently and all three targets are verified absent;
7. `enrollments` remains present with 0 rows and `classes` remains present with 2,206 rows.

Disposition:
- `students`, `student`, and `schools` are `retired_verified`;
- preserve the retained classroom schema and continue institution-model review separately.

### enrollments / classes

Local review on 2026-09-30 confirmed that the classroom schema has an active runtime dependency, not merely a policy-test dependency:

- `torquemind-api/index.js` reads and writes both `classes` and `enrollments`;
- the browser classroom UI calls the class create/list/join routes;
- Render deployment configuration and CI smoke/unit workflows actively include `torquemind-api`;
- current CI starts the API against the approved staging Supabase project.

Production data state:
- `enrollments`: 0 rows;
- `classes`: 2,206 rows;
- distinct class owners: 1, matching an existing Auth user;
- assignments referencing a class: 0;
- scenario assignments referencing a class: 0;
- classes with enrollments: 0;
- classes with assignments: 0;
- classes with scenario assignments: 0;
- all 2,206 class names match the smoke-test fixture naming pattern;
- no new class rows were created during the most recent 7-day window reviewed.

Root cause:
- `torquemind-api/scripts/smoke-test.js` creates a uniquely named smoke-test class on every run;
- the script previously had no cleanup path;
- current CI targets the approved staging project, so the production accumulation is historical.

Disposition:
- `classes` and `enrollments` are active runtime assets and must remain;
- the smoke test must delete only the exact fixture row it created, including on failure;
- after the leak fix is merged, prepare a separately guarded cleanup for the 2,206 verified historical smoke rows;
- keep institution onboarding expansion frozen pending the institution-model decision.

## Security findings

### Public recommendation read — access migration implemented

The baseline review found anonymous SELECT with an unconditional RLS predicate and a direct dashboard dependency.

The access-migration follow-up:
- moves the dashboard to an authenticated application API;
- removes direct browser access to the legacy table;
- revokes anonymous/authenticated table privileges when the legacy table exists;
- preserves service-role access for the temporary server-side bridge;
- does not recreate the legacy table in fresh environments.

The table remains a migration target, not a permanent recommendation architecture.

### Legacy views — dashboard migration implemented

The baseline views use `security_invoker=true` and derive from `question_attempts`. The dashboard no longer reads either view directly.

The progress-migration follow-up:
- moves both panels to an authenticated application API;
- derives progress from canonical `attempts` and `attempt_answers`;
- scopes both canonical queries to the verified user ID;
- removes the student identifier and unsupported legacy timing metric from dashboard output;
- revokes anonymous/authenticated privileges on the two legacy views when they exist;
- does not recreate legacy views in clean environments.

The legacy progress views and their dependent legacy chain have now been retired from production and verified absent.

## Ordered cleanup plan

1. **Recommendation access migration — implemented**
   - dashboard direct table read removed;
   - authenticated server-side bridge added;
   - anonymous/authenticated table privileges revoked by guarded migration;
   - legacy table retirement remains pending replacement-model/consumer verification.

2. **Performance/transcript migration + legacy progress retirement — complete**
   - authenticated canonical progress API added;
   - dashboard legacy summary-view reads removed;
   - guarded production retirement migration applied on 2026-09-30;
   - 80 historical anonymous legacy rows and the verified dependent legacy view chain removed;
   - post-change verification confirmed canonical progress tables remain present.

3. **Identified transcript cleanup**
   - verify no retention obligation;
   - delete the single identified/linkable legacy transcript row using the approved deletion runbook.

4. **Empty roster-shell retirement**
   - retire empty `student`, `students`, and `schools` structures once migration/dependency review is complete.

5. **Classroom row cleanup**
   - retain `classes` / `enrollments` schema;
   - investigate the single-owner 2,206-row orphan set;
   - archive/delete only after ownership/use review and dry-run evidence.

## Destructive-operation gates

Before any deletion/drop migration:
- create a dependency report;
- provide row-count dry run;
- confirm legal/security holds;
- confirm current consumer inventory;
- document rollback/recovery strategy;
- verify production backup/restore implications;
- require explicit authorized execution;
- verify post-change application and RLS behavior.

## Verification evidence

- Production schema, row counts, RLS policies, grants, foreign keys, and view definitions inspected read-only.
- Repository runtime/API references inspected against current `main`.
- No production mutation was performed.
- No student identifiers, names, or record contents were copied into this document.

## Next implementation

The smallest safe next implementation is the recommendation-access migration because it is the only reviewed legacy asset with confirmed direct anonymous table access from the student dashboard.
