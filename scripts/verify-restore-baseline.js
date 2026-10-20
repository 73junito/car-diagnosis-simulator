#!/usr/bin/env node
'use strict';

/**
 * Compares a restore verification matrix (scripts/sql/restore-verification-matrix.sql)
 * against a recorded backup baseline manifest.
 *
 * The baseline describes the BACKUP contents, so every expectation is an exact
 * match against the restored copy. Canonical-repository drift is reported as
 * informational only: the staging migration parity gate owns that check.
 *
 * Exit code: 0 when every check passes, 1 otherwise. Never writes to a database.
 */

const fs = require('fs');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sameSet(a, b) {
  const left = [...(a || [])].map(String).sort();
  const right = [...(b || [])].map(String).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function push(checks, name, expected, actual, ok) {
  checks.push({ name, expected, actual, ok: Boolean(ok) });
}

function compareMatrixToBaseline(matrix, baseline) {
  const checks = [];
  const expectations = baseline.expectations || {};

  const history = matrix.migration_history || {};
  const expectedHistory = expectations.migration_history || {};
  push(checks, 'migration_history.count', expectedHistory.count, history.count, history.count === expectedHistory.count);
  push(checks, 'migration_history.max_version', expectedHistory.max_version, history.max_version,
    history.max_version === expectedHistory.max_version);
  push(checks, 'migration_history.versions',
    `${(expectedHistory.versions || []).length} version(s)`,
    `${(history.versions || []).length} version(s)`,
    sameSet(history.versions, expectedHistory.versions));

  push(checks, 'schemas', expectations.schemas, matrix.schemas, sameSet(matrix.schemas, expectations.schemas));

  const expectedExtensions = expectations.extensions || {};
  const actualExtensions = matrix.extensions || {};
  push(checks, 'extensions', expectedExtensions, actualExtensions,
    sameSet(Object.keys(actualExtensions), Object.keys(expectedExtensions))
    && Object.keys(expectedExtensions).every((key) => actualExtensions[key] === expectedExtensions[key]));

  const roles = matrix.roles || {};
  const requiredRoles = expectations.roles_required || [];
  const missingRoles = requiredRoles.filter((role) => roles[role] !== true);
  push(checks, 'roles.required_present', requiredRoles,
    missingRoles.length ? `missing: ${missingRoles.join(',')}` : 'all present', missingRoles.length === 0);

  const publicObjects = matrix.public_objects || {};
  const expectedPublic = expectations.public_objects || {};
  for (const key of ['tables', 'views', 'rls_enabled', 'policies']) {
    push(checks, `public_objects.${key}`, expectedPublic[key], publicObjects[key],
      publicObjects[key] === expectedPublic[key]);
  }
  push(checks, 'public_objects.rls_disabled', [], publicObjects.rls_disabled || [],
    (publicObjects.rls_disabled || []).length === 0);

  const rls = matrix.rls || {};
  const expectedRls = expectations.rls || {};
  for (const key of ['tables_total', 'tables_enabled', 'policy_count']) {
    push(checks, `rls.${key}`, expectedRls[key], rls[key], rls[key] === expectedRls[key]);
  }

  const rowCounts = matrix.row_counts || {};
  const expectedRowCounts = expectations.row_counts || {};
  for (const key of Object.keys(expectedRowCounts).sort()) {
    push(checks, `row_counts.${key}`, expectedRowCounts[key], rowCounts[key], rowCounts[key] === expectedRowCounts[key]);
  }

  const required = matrix.required_tables || {};
  push(checks, 'required_tables.missing', [], required.missing || [], (required.missing || []).length === 0);
  push(checks, 'required_tables.expected', (expectations.required_tables || []).length, required.expected,
    required.expected === (expectations.required_tables || []).length);

  const taxonomy = matrix.taxonomy || {};
  const expectedTaxonomy = expectations.taxonomy_pre_migration || {};
  for (const key of Object.keys(expectedTaxonomy).sort()) {
    push(checks, `taxonomy.${key}`, expectedTaxonomy[key], taxonomy[key],
      sameSet(taxonomy[key], expectedTaxonomy[key]));
  }

  const integrity = matrix.integrity || {};
  const expectedIntegrity = expectations.integrity || {};
  for (const key of Object.keys(expectedIntegrity).sort()) {
    push(checks, `integrity.${key}`, expectedIntegrity[key], integrity[key], integrity[key] === expectedIntegrity[key]);
  }

  push(checks, 'schema_fingerprint', expectations.schema_fingerprint, matrix.schema_fingerprint,
    matrix.schema_fingerprint === expectations.schema_fingerprint);

  const canonical = baseline.canonical_repository_expectation || {};
  const informational = [{
    name: 'canonical_repository_drift',
    backup_migrations: (expectedHistory.versions || []).length,
    canonical_migrations: canonical.migrations,
    missing_from_backup: canonical.missing_from_backup || [],
    note: canonical.note || ''
  }];

  const failures = checks.filter((check) => !check.ok);
  return { checks, failures, informational, verdict: failures.length === 0 ? 'PASS' : 'FAIL' };
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main() {
  const matrixPath = arg('--matrix');
  const baselinePath = arg('--baseline');
  const reportPath = arg('--report');
  if (!matrixPath || !baselinePath) {
    throw new Error('usage: verify-restore-baseline.js --matrix <matrix.json> --baseline <baseline.json> [--report <out.json>]');
  }

  const matrix = loadJson(matrixPath);
  const baseline = loadJson(baselinePath);
  const result = compareMatrixToBaseline(matrix, baseline);

  const report = {
    generated_at: new Date().toISOString(),
    matrix_database: matrix.database,
    matrix_generated_at: matrix.generated_at,
    baseline_backup_run_id: (baseline.backup || {}).workflow_run_id,
    schema_fingerprint: matrix.schema_fingerprint,
    checks_total: result.checks.length,
    checks_passed: result.checks.filter((check) => check.ok).length,
    checks_failed: result.failures.length,
    verdict: result.verdict,
    checks: result.checks,
    informational: result.informational
  };

  if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  for (const check of result.checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}`);
    if (!check.ok) {
      console.log(`     expected: ${JSON.stringify(check.expected)}`);
      console.log(`     actual:   ${JSON.stringify(check.actual)}`);
    }
  }
  for (const info of result.informational) {
    console.log(`INFO ${info.name}: backup=${info.backup_migrations} canonical=${info.canonical_migrations} missing=${JSON.stringify(info.missing_from_backup)}`);
  }
  console.log(`RESTORE VERIFICATION: ${result.verdict} (${report.checks_passed}/${report.checks_total} checks passed)`);

  if (result.failures.length) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { compareMatrixToBaseline, loadJson, sameSet };
