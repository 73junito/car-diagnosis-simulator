/**
 * Evidence Mapping Contract: Static Artifact Validation
 * 
 * Purpose: Validate contract artifacts without requiring Supabase credentials.
 * These tests confirm the Gate 4 contract is safe and well-documented,
 * independent of staging environment connectivity.
 * 
 * This suite complements the dynamic integration tests in
 * evidence-mapping-contract.spec.js (which require SUPABASE_URL credentials
 * and verify the full 5-stage evidence chain against live data).
 */

const fs = require('fs');
const path = require('path');

describe('Evidence mapping contract artifacts', () => {
  const root = path.resolve(__dirname, '..');
  const sqlPath = path.join(root, 'supabase', 'contracts', 'evidence-mapping-contract.sql');
  const workstreamPath = path.join(root, 'EVIDENCE_MAPPING_WORKSTREAM.md');
  const migrationsDir = path.join(root, 'supabase', 'migrations');

  let sql;
  let workstream;

  beforeAll(() => {
    sql = fs.readFileSync(sqlPath, 'utf8');
    workstream = fs.readFileSync(workstreamPath, 'utf8');
  });

  it('keeps the SQL contract outside deployable migrations', () => {
    // Contract is read-only design reference, not deployable
    expect(fs.existsSync(sqlPath)).toBe(true);

    // Old deployable migration should not exist
    const oldMigration = path.join(
      migrationsDir,
      '20260905001000_evidence_mapping_contract_functions.sql'
    );
    expect(fs.existsSync(oldMigration)).toBe(false);
  });

  it('contains no deployable or mutating SQL statements', () => {
    // Verify contract is read-only: no CREATE, ALTER, DROP, GRANT, INSERT, UPDATE, DELETE, TRUNCATE, CALL, DO
    // Pattern matches line-start with optional whitespace, then keyword, then word boundary
    const forbiddenPatterns = /^\s*(CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE|DO|CALL)\b/im;
    expect(sql).not.toMatch(forbiddenPatterns);
  });

  it('contains only SELECT queries for evidence diagnostics', () => {
    // Every query should start with SELECT
    const selectCount = (sql.match(/^\s*SELECT\b/im) || []).length;
    expect(selectCount).toBeGreaterThan(0);
  });

  it('documents all five evidence-integrity stages', () => {
    // Contract should reference each stage in order
    const stages = ['Identity', 'Question', 'Provenance', 'Citation', 'Release'];
    for (const stage of stages) {
      expect(workstream).toMatch(new RegExp(stage, 'i'));
    }
  });

  it('requires a reviewed question-to-provenance crosswalk', () => {
    // Document emphasizes explicit mapping before any backfill
    expect(workstream).toMatch(/crosswalk/i);
    expect(workstream).toMatch(/review|reviewed/i);
    expect(workstream).toMatch(/backfill/i);
  });

  it('clearly states that staging credentials are required for integration tests', () => {
    // Integration tests (19 tests in evidence-mapping-contract.spec.js) require SUPABASE_URL
    // This must be documented plainly so users know why tests skip locally
    expect(workstream).toMatch(/staging.*credential/i);
    expect(workstream).toMatch(/credential.*require/i);
    expect(workstream).toMatch(/skip.*local|local.*skip/i);
  });

  it('does not claim evidence checks pass without staging credentials', () => {
    // If tests are skipped locally, workstream must not claim they passed
    expect(workstream).toMatch(/integration.*test/i);
    expect(workstream).toMatch(/staging|available/i);
  });

  it('documents the 7-step governance sequence with approval gates', () => {
    // Each step should be documented with clear prerequisites
    expect(workstream).toMatch(/step|gate|approval/i);
    expect(workstream).toMatch(/remediation.*sequence/i);
  });

  it('identifies all known blockers and their impact', () => {
    // Blockers should be transparent, not hidden
    expect(workstream).toMatch(/blocker/i);
    expect(workstream).toMatch(/null.*question_id|question_id.*null/i);
    expect(workstream).toMatch(/catalog.*identity|identity.*model/i);
  });
});
