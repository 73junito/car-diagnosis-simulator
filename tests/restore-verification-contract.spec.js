const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

const workflowPath = '.github/workflows/verify-staging-backup-restore.yml';
const matrixPath = 'scripts/sql/restore-verification-matrix.sql';
const baselinePath = 'docs/database/staging-restore-baseline-40034471907.json';
const supersededBaselinePath = 'docs/database/staging-restore-baseline-39172287178.json';
const restoredMatrixPath = 'tests/fixtures/restore-verification-matrix-40156618194.json';
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
    expect(baseline.backup.workflow_run_id).toBe(40034471907);
    expect(baseline.backup.ciphertext_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(baseline.backup.source_project_ref).toBe('jchfruprqpeypdttvlam');
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

describe('restore baseline fingerprint algorithm reconciliation', () => {
  const workflow = read(workflowPath);
  const sql = read(matrixPath);
  const baseline = JSON.parse(read(baselinePath));
  const superseded = JSON.parse(read(supersededBaselinePath));

  test('the workflow defaults to the current baseline, never the superseded one', () => {
    expect(workflow).toContain(`default: '${baselinePath}'`);
    expect(workflow).not.toContain(`default: '${supersededBaselinePath}'`);
    expect(workflow).not.toContain(supersededBaselinePath);
  });

  test('the fingerprint algorithm changed between the two baselines', () => {
    // The two baselines describe the same staging schema but were recorded under
    // different fingerprint normalisations, so their overall fingerprints differ.
    // If this ever becomes equal, one of the two records was re-normalised and
    // the reconciliation below must be revisited.
    expect(baseline.expectations.schema_fingerprint)
      .not.toBe(superseded.expectations.schema_fingerprint);
  });

  test('the superseded fingerprint is recorded for audit rather than silently dropped', () => {
    expect(baseline.diagnostics.historical_20261018_fingerprint)
      .toBe(superseded.expectations.schema_fingerprint);
  });

  test('the fingerprint difference is not schema drift: every substantive expectation is identical', () => {
    // This is the reconciliation that proves the fingerprint mismatch is an
    // algorithm-version artifact. If any substantive section diverged, the
    // mismatch would be real schema drift and the baseline would have to be
    // re-captured instead of reconciled.
    for (const section of [
      'schemas',
      'extensions',
      'roles_required',
      'public_objects',
      'rls',
      'row_counts',
      'required_tables',
      'taxonomy_pre_migration',
      'integrity'
    ]) {
      expect(baseline.expectations[section]).toEqual(superseded.expectations[section]);
    }
    expect(baseline.expectations.migration_history.count)
      .toBe(superseded.expectations.migration_history.count);
    expect(baseline.expectations.migration_history.max_version)
      .toBe(superseded.expectations.migration_history.max_version);
    expect([...baseline.expectations.migration_history.versions].sort())
      .toEqual([...superseded.expectations.migration_history.versions].sort());
  });

  test('the current baseline records per-category fingerprints for mismatch diagnosis', () => {
    const categories = baseline.diagnostics.schema_component_fingerprints;
    expect(Object.keys(categories).sort()).toEqual([
      'col', 'con', 'ext', 'fn', 'idx', 'pol', 'rel', 'schema', 'trg'
    ]);
    for (const [category, checksum] of Object.entries(categories)) {
      expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test('the matrix SQL still emits the normalisation the current baseline was recorded under', () => {
    // If the normalisation in the matrix SQL changes again, the recorded
    // fingerprint no longer matches a freshly restored copy and the baseline
    // must be re-captured. Guard the two normalisation markers that changed
    // the fingerprint between the two recorded baselines.
    expect(sql).toContain('set search_path = auth, public, extensions, pg_catalog;');
    expect(sql).toContain('row_number() over (partition by table_schema, table_name');
  });
});

describe('restore verification against real restored-backup evidence', () => {
  // Matrix emitted by the real restore of encrypted staging backup
  // 40156128866 (workflow run 40156618194, artifact
  // restore-verification-40156618194). It is the matrix of a genuinely
  // restored copy, not a synthesised one, so it proves the reconciliation
  // against restore evidence rather than against a hand-written expectation.
  const restoredMatrix = JSON.parse(read(restoredMatrixPath));
  const baseline = JSON.parse(read(baselinePath));
  const superseded = JSON.parse(read(supersededBaselinePath));

  test('the restored copy matches the current baseline on every check', () => {
    const result = compareMatrixToBaseline(restoredMatrix, baseline);
    expect(result.failures).toEqual([]);
    expect(result.verdict).toBe('PASS');
  });

  test('the restored copy matches the superseded baseline except for the fingerprint', () => {
    // This is the decisive evidence that the historical fingerprint mismatch
    // is an algorithm-version artifact and not schema drift: every substantive
    // check passes against the superseded baseline too, and the fingerprint is
    // the only difference.
    const result = compareMatrixToBaseline(restoredMatrix, superseded);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.map((failure) => failure.name)).toEqual(['schema_fingerprint']);
  });

  test('canonical drift stays informational on real restore evidence', () => {
    const result = compareMatrixToBaseline(restoredMatrix, baseline);
    expect(result.informational[0].name).toBe('canonical_repository_drift');
    expect(result.informational[0].missing_from_backup)
      .toEqual(['20261013190000_retire_external_certification_taxonomy.sql']);
  });

  test('the restored copy fingerprint equals the current baseline fingerprint', () => {
    expect(restoredMatrix.schema_fingerprint).toBe(baseline.expectations.schema_fingerprint);
    expect(restoredMatrix.schema_fingerprint)
      .not.toBe(superseded.expectations.schema_fingerprint);
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
