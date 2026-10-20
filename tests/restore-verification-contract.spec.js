const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

const workflowPath = '.github/workflows/verify-staging-backup-restore.yml';
const matrixPath = 'scripts/sql/restore-verification-matrix.sql';
const baselinePath = 'docs/database/staging-restore-baseline-39172287178.json';
const { compareMatrixToBaseline } = require('../scripts/verify-restore-baseline.js');

describe('restore verification workflow contract', () => {
  const workflow = read(workflowPath);

  test('keeps every restore safety property', () => {
    expect(workflow).toContain('--exit-on-error');
    expect(workflow).toContain('--no-owner --no-acl');
    expect(workflow).toContain('--network none');
    expect(workflow).toContain('createdb');
    expect(workflow).toContain('-T template0');
    expect(workflow).toContain("rolname = 'supabase_admin'");
    expect(workflow).toContain('sha256sum -c staging.dump.gpg.sha256');
    expect(workflow).toContain('::add-mask::$BACKUP_PASSPHRASE');
    expect(workflow).toContain('STAGING_BACKUP_PASSPHRASE');
    expect(workflow).toContain('environment: jchfruprqpeypdttvlam_staging');
    expect(workflow).toContain("inputs.confirm == 'VERIFY-RESTORE'");
  });

  test('pins the disposable image by digest', () => {
    expect(workflow).toMatch(/ghcr\.io\/supabase\/postgres:17\.6\.1\.167@sha256:[0-9a-f]{64}/);
  });

  test('emits the matrix before the disposable container is removed', () => {
    const matrixIndex = workflow.indexOf('restore-verification-matrix.json');
    const compareIndex = workflow.indexOf('verify-restore-baseline.js');
    expect(matrixIndex).toBeGreaterThan(-1);
    expect(compareIndex).toBeGreaterThan(matrixIndex);
  });

  test('compares against the recorded baseline and uploads evidence', () => {
    expect(workflow).toContain('--baseline "${{ inputs.baseline_manifest }}"');
    expect(workflow).toContain('--report "$RUNNER_TEMP/restore/restore-verification-report.json"');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('restore-verification-${{ github.run_id }}');
  });

  test('never fakes migration history or resets the database', () => {
    expect(workflow).not.toMatch(/migration\s+repair/);
    expect(workflow).not.toMatch(/db\s+reset/);
    expect(workflow).not.toMatch(/schema_migrations\s*\(/);
  });
});

describe('restore verification matrix SQL contract', () => {
  const sql = read(matrixPath);

  test('is read-only', () => {
    expect(sql).not.toMatch(/^\s*(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/im);
  });

  test('emits the JSON keys the comparator consumes', () => {
    for (const key of [
      'migration_history', 'schemas', 'object_counts', 'extensions', 'roles',
      'rls', 'public_objects', 'row_counts', 'required_tables', 'taxonomy',
      'integrity', 'schema_fingerprint', 'schema_component_fingerprints'
    ]) {
      expect(sql).toContain(`'${key}'`);
    }
  });

  test('documents the fingerprint normalisation exclusions', () => {
    expect(sql).toContain('--no-owner --no-acl');
    expect(sql).toMatch(/excluded:/i);
  });
});

describe('restore baseline manifest contract', () => {
  const baseline = JSON.parse(read(baselinePath));

  test('describes the verified backup run', () => {
    expect(baseline.schema_version).toBe(1);
    expect(baseline.backup.workflow_run_id).toBe(39172287178);
    expect(baseline.backup.restore_verified_run_id).toBe(39180383455);
    expect(baseline.backup.ciphertext_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(baseline.backup.local_copy_sha256_verified).toBe(true);
  });

  test('records the staging expectations observed at backup time', () => {
    const e = baseline.expectations;
    expect(e.migration_history.count).toBe(105);
    expect(e.public_objects.tables).toBe(76);
    expect(e.public_objects.rls_enabled).toBe(76);
    expect(e.public_objects.rls_disabled).toEqual([]);
    expect(e.row_counts.scenario_catalog).toBe(19);
    expect(e.row_counts.scenario_questions).toBe(25);
    expect(e.row_counts.battery_temperature_telemetry).toBe(425862);
    expect(e.row_counts.auth_users).toBe(3);
    expect([...e.taxonomy_pre_migration.legacy_prefix_columns].sort())
      .toEqual(['scenario_catalog', 'scenario_questions']);
    expect(e.taxonomy_pre_migration.diagnostic_area_columns).toEqual([]);
    expect(e.schema_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  test('treats canonical drift as informational, not as a restore failure', () => {
    expect(baseline.canonical_repository_expectation.migrations).toBe(106);
    expect(baseline.canonical_repository_expectation.missing_from_backup)
      .toEqual(['20261013190000_retire_external_certification_taxonomy.sql']);
  });
});

describe('restore baseline comparator', () => {
  const baseline = JSON.parse(read(baselinePath));

  const matchingMatrix = () => JSON.parse(JSON.stringify({
    database: 'staging_restore_check',
    generated_at: '2026-10-19T00:00:00Z',
    migration_history: baseline.expectations.migration_history,
    schemas: baseline.expectations.schemas,
    extensions: baseline.expectations.extensions,
    roles: { anon: true, authenticated: true, postgres: true, service_role: true, supabase_admin: true },
    rls: baseline.expectations.rls,
    public_objects: baseline.expectations.public_objects,
    row_counts: baseline.expectations.row_counts,
    required_tables: { expected: baseline.expectations.required_tables.length, missing: [] },
    taxonomy: baseline.expectations.taxonomy_pre_migration,
    integrity: baseline.expectations.integrity,
    schema_fingerprint: baseline.expectations.schema_fingerprint
  }));

  test('passes when the restored copy matches the backup baseline', () => {
    const result = compareMatrixToBaseline(matchingMatrix(), baseline);
    expect(result.verdict).toBe('PASS');
    expect(result.failures).toEqual([]);
    expect(result.checks.length).toBeGreaterThan(30);
  });

  test('fails when a restored row count differs', () => {
    const matrix = matchingMatrix();
    matrix.row_counts.battery_temperature_telemetry = 1;
    const result = compareMatrixToBaseline(matrix, baseline);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.map((f) => f.name)).toContain('row_counts.battery_temperature_telemetry');
  });

  test('fails when a table lost its RLS flag or a schema is missing', () => {
    const matrix = matchingMatrix();
    matrix.public_objects.rls_enabled = 75;
    matrix.public_objects.rls_disabled = ['scenario_questions'];
    matrix.schemas = matrix.schemas.filter((s) => s !== 'vault');
    const result = compareMatrixToBaseline(matrix, baseline);
    const failed = result.failures.map((f) => f.name);
    expect(result.verdict).toBe('FAIL');
    expect(failed).toContain('public_objects.rls_enabled');
    expect(failed).toContain('public_objects.rls_disabled');
    expect(failed).toContain('schemas');
  });

  test('reports canonical repository drift as informational', () => {
    const result = compareMatrixToBaseline(matchingMatrix(), baseline);
    expect(result.informational[0].name).toBe('canonical_repository_drift');
    expect(result.informational[0].missing_from_backup)
      .toEqual(['20261013190000_retire_external_certification_taxonomy.sql']);
  });
});
