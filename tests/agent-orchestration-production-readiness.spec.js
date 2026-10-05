const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const readiness = require('../data/architecture/agent-orchestration-production-migration-readiness.json');

describe('Phase 7 production migration readiness', () => {
  test('readiness evidence is bound to the exact repository migration', () => {
    const migrationPath = path.join(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20261005031812_create_orchestration_persistence_rpc.sql'
    );

    const canonicalMigration = fs
      .readFileSync(migrationPath, 'utf8')
      .replace(/\r\n/g, '\n');

    const digest = crypto
      .createHash('sha256')
      .update(canonicalMigration, 'utf8')
      .digest('hex');

    expect(readiness.migration.version).toBe('20261005031812');
    expect(readiness.migration.repository_sha256).toBe(digest);
    expect(readiness.migration.staging_verified).toBe(true);
    expect(readiness.migration.present_in_production).toBe(false);
    expect(readiness.migration.applied_in_production).toBe(false);
  });

  test('production preflight has no orchestration collision or missing hash dependency', () => {
    expect(readiness.preflight).toMatchObject({
      orchestration_private_schema_exists: false,
      orchestration_function_conflicts: 0,
      pgcrypto_installed: true,
      extensions_digest_available: true,
      blocking_orchestration_advisor_findings: 0,
    });
  });

  test('runtime and assessment authority remain unchanged', () => {
    expect(readiness.current_authority).toMatchObject({
      production_runtime_persistence_enabled: false,
      application_runtime_switched: false,
      assessment_eligibility_changed: false,
      scored_delivery_authority_changed: false,
      production_assessment_api_eligibility_changed: false,
      production_release_authority_changed: false,
    });

    expect(readiness.required_production_gate_sequence.at(-1)).toMatch(
      /runtime switch remains a separate change/i
    );
  });
});
