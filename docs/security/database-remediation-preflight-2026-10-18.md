# Security remediation preflight — 2026-10-18
Status: NOT EXECUTED. DBA/security review and a verified recoverable backup required before running against production.

## Confirmed database observations
- Staging: 105 applied migrations; main canonical baseline 106. Missing version 20261013190000 (retire_external_certification_taxonomy). Staging has scenario_questions.ase_area with 22 populated rows.
- Production: public.assignments has permissive authenticated SELECT policy assignments_read_authenticated with USING (true). RLS is enabled but this unrestricted permissive policy wins by OR against narrower policies.
- PUBLIC table grants: 21 production tables grant TRUNCATE to anon and authenticated; 11 such tables in staging. TRUNCATE is not subject to row-level security. Review all grants and revoke unwanted TRUNCATE grants through audited migrations.
- Database configuration both projects: max_connections=60, statement_timeout=2min, idle_in_transaction_session_timeout=0, lock_timeout=0.
- Advisors: staging 64 RLS-without-policy (often intentional deny), production 65; staging 45 unindexed foreign keys, production 48. Production multiple-permissive-policy warnings=7 and auth RLS initplan warnings=12.

## Proposed production policy/grant correction (requires approvals)
1. Confirm intended assignment visibility via the application owner and cross-user tests. The policy assignments_read_authenticated is demonstrably broad; replacing it with owner/member-level predicates is safer. Stage test the correct policy rather than blindly enabling or disabling functionality.
2. Revoke TRUNCATE from anon/authenticated on application tables (audit for explicit operational exceptions first).
3. Commit audited SQL through a Supabase CLI-generated migration, test against a restored staging copy, and deploy with rollback plan.
4. Verify effective privileges as anon and authenticated; test users in different institutions/classes cannot read each other's assignments.
5. Confirm all required checks and migration parity.

## Separate staging schema fix
Apply *exact* existing canonical supabase/migrations/20261013190000_retire_external_certification_taxonomy.sql through the approved historical-version reconciliation procedure. Supabase MCP apply_migration generates a new timestamp, so it MUST NOT be used to masquerade as canonical version 20261013190000. Backup and test first; verify 106/106 migration parity and same 25 scenario_questions records, 22 populated diagnostic_area values.

## No changes performed
No database permissions, data, policy, or migration history changed in this investigation. Avoid adding any public security-sensitive issue details before a coordinated review.
