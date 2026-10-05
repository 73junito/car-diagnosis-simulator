const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const verification = require('../data/architecture/agent-orchestration-production-persistence-verification.json');
const contract = require('../data/architecture/agent-orchestration-production-persistence-contract.json');

describe('Phase 8 production persistence verification', () => {
  test('production verification is bound to the canonical repository migration', () => {
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

    expect(verification.repository_migration.canonical_sha256).toBe(digest);
    expect(verification.production_migration.applied).toBe(true);
    expect(verification.production_migration.name)
      .toBe('create_orchestration_persistence_rpc');
  });

  test('live production controls passed and all disposable rows were cleaned', () => {
    expect(verification.security).toMatchObject({
      rls_enabled_all: true,
      anon_table_select: false,
      authenticated_table_select: false,
      service_role_table_select: true,
      rpc_count: 6,
      anon_rpc_execute: false,
      authenticated_rpc_execute: false,
      service_role_rpc_execute: true,
    });

    expect(verification.live_contract_checks).toMatchObject({
      competing_worker_rejected: 'lease_conflict',
      invalid_integrity_hash_rejected: 'integrity_hash_invalid',
      stale_version_rejected: 'version_conflict',
      javascript_postgres_hash_alignment: true,
      chained_entry_count: 2,
      checkpoint_write_verified: true,
      checkpoint_version: 2,
      test_data_cleaned: true,
      remaining_entries: 0,
      remaining_checkpoints: 0,
      remaining_leases: 0,
    });
  });

  test('database is ready but runtime and assessment authority remain unchanged', () => {
    expect(contract.deployment_status)
      .toBe('production-applied-runtime-not-switched');

    expect(verification.runtime_state).toMatchObject({
      production_runtime_persistence_enabled: false,
      application_runtime_switched: false,
      production_database_schema_ready: true,
    });

    expect(verification.advisors.orchestration_specific_blockers).toBe(0);
  });
});
