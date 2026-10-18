# Database privilege remediation — execution gate

**Status: not applied.** PR #1074 contains proposed SQL under scripts/sql, not a deployable Supabase migration. Do not run as-is against production.

## Verified environment inventory (2026-10-18)
- Staging project: `jchfruprqpeypdttvlam`, ACTIVE_HEALTHY; **no Supabase development branches**.
- Production project: `pffdgqpynpbffbcnxmum`, ACTIVE_HEALTHY.
- Production has an existing preview project for PR #1063 (`ijyjrtcenbpiijubdlsc`), which has 107 migrations and 77 public tables. It is NOT a restored copy of staging and must not be used to claim staging-data validation.
- Public base-table TRUNCATE grants: 11 staging, 21 production, for `anon`/`authenticated`.
- Production `public.assignments`: RLS enabled; permissive `assignments_read_authenticated` has `USING (true)`, which combines with narrower SELECT rules using OR.
- Staging missing canonical migration `20261013190000_retire_external_certification_taxonomy.sql`; do not mark history as applied unless the exact reviewed schema/data change is committed in the same approved deployment.

## Deployment prerequisites
1. Obtain verified database backup and test recovery before any staging or production DDL. Document restore steps, retention, and owner.
2. Confirm whether all browser-role TRUNCATE privileges are accidental; check service-role workflows separately. PostgreSQL TRUNCATE bypasses row-level security.
3. Create a data-equivalent disposable staging restore; rehearse the grant revocation. Do not substitute an empty Supabase branch for a data-equivalent restore.
4. Exercise instructor/student/anonymous users, including cross-institution and cross-class SELECT/INSERT/UPDATE/DELETE authorization tests. Particularly test `public.assignments`.
5. Request DBA and application-owner review. Generate a normal uniquely numbered migration with the Supabase CLI (rather than copying the review script into an ad hoc schema edit).
6. Apply staging via approved migration workflow, verify the postcondition using `scripts/sql/verify-public-grants-remediation.sql`, review application smoke tests and roll back if necessary.
7. Only then separately authorize production deployment. Do not merge a migration merely to clear a CI check.

## Postconditions
- No unintended `TRUNCATE` on exposed public base tables for `anon`/`authenticated`.
- No broad permissive `USING (true)` assignment policy for authenticated users after the separately approved policy correction.
- RLS stays enabled and other needed privileges unchanged.
- Migration history matches canonical source; existing row counts and tenant boundaries preserved.
- No adjustment to grading, assessment eligibility, production routes, or learner data.

## Current blockers
- No verified recoverable data-equivalent test environment/restore evidence.
- No documented approved assignment-visibility authorization model or sign-off.
- Staging migration drift unresolved.
