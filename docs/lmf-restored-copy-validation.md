# LMF staging taxonomy rehearsal: restored-copy validation

Evidence date: 2026-10-24 (US Central). This document records independently queried checks, not a release approval.

## Scope

- Original, **unchanged** staging: `jchfruprqpeypdttvlam` (`torquemind-staging`).
- Isolated restored copy: `nbgvllelsfhnmuwuqlkw` (`autolearnpro`).
- Source backup: physical backup dated 2026-10-24 13:24:39 UTC; Supabase dashboard reported restored-to-new-project operation COMPLETED at 2026-10-25 00:22:29 UTC.
- Canonical SQL source: `supabase/migrations/20261013190000_retire_external_certification_taxonomy.sql` from `main`.
- Applied the SQL **only to restored copy** through the Supabase migration operation. Tool-assigned test migration version: `20261025003714`; this version is **not** the canonical staging history version and must not be used as parity evidence.

## Observed results

| Comparison | Staging | Restored after rehearsal | Conclusion |
|---|---|---|---|
| Public tables before rehearsal | 76 | 76 | Matching inventory count |
| Scenario questions | 25 | 25 | Count preserved |
| Scenario catalog | 19 | 19 | Count preserved |
| Legacy area columns on both tables | 2 | 0 | Renamed on restored copy |
| Replacement diagnostic area columns | 0 | 2 | Present on restored copy |
| Null area values (questions) | 3 | 3 | Unchanged |
| Null area values (catalog) | 19 | 19 | Unchanged |
| PK, FK, CHECK constraint names and types | Baseline | Same | Structurally matching |
| RLS SELECT policy definitions | Baseline | Same | Policy text preserved; not an authorization test |
| Normalized complete question-row content digest (MD5) | `178a63a464c7271c78714dfdc728b8bd` | Same | Matching at query time |
| Normalized complete catalog-row content digest (MD5) | `d41d8cd98f00b204e9800998ecf8427e` | Same | Matching at query time |

The row digests were computed by serializing **all columns and values**, transforming the legacy area field name to the replacement field name before hashing, sorting serialized rows, then concatenating and hashing. A second comparison excluding both area fields also matched. MD5 here is a consistency fingerprint rather than a cryptographic security proof. These results describe the queried tables at inspection time; they do not constitute a full-database restore checksum.

## Outstanding, mandatory

1. Test actual `anon` and `authenticated` requests against the **restored project's** REST endpoint, with dedicated restored-project credentials and throwaway test accounts where appropriate. Verify unauthorized writes are rejected and any row visibility restrictions hold. The direct database inspection role is privileged; comparing policy definitions does **not** execute RLS as an end user.
2. Test application query contracts and UI/API flows against the restored project; explicitly inspect consumers that still request retired taxonomy fields. Never repoint production applications to the restored project.
3. Plan controlled staging execution using the canonical migration machinery. Do not substitute the generated restored-copy migration history version for the canonical version.
4. After staging deployment, recheck canonical migration parity, data integrity, authenticated smoke tests, CI, and release-evidence approvals. Keep PR #1128 draft until all required independent gates are satisfied.

No staging or production SQL changes were performed by these validation queries. The restored project may incur continuing cost.
