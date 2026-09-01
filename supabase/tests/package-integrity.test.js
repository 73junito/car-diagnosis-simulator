'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const seed = fs.readFileSync(path.join(root, 'seed.sql'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'ADDITIVE_QUESTION_LOADER.sql'), 'utf8');
const rls = fs.readFileSync(path.join(root, 'rls.sql'), 'utf8');

test('seed entry point is portable and nondestructive', () => {
  assert.doesNotMatch(seed, /^\s*\\(?:i|set)\b/m);
  assert.doesNotMatch(seed, /^\s*(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)/im);
});

test('question loader references only verified staging schema', () => {
  assert.doesNotMatch(loader, /public\.source_scenarios|public\.question_approvals/);
  assert.doesNotMatch(loader, /\bchunk_hash\b|\bupdated_at\b/);
  assert.doesNotMatch(loader, /^\s*\\set\b/m);
  assert.doesNotMatch(loader, /^\s*ROLLBACK\s*;/im);
  assert.doesNotMatch(loader, /ON\s+CONFLICT\s*\(\s*scenario_id\s*,\s*question_text\s*\)/i);
});

test('question loader creates draft provenance without synthetic approvals', () => {
  assert.match(loader, /'draft'/);
  assert.match(loader, /pg_advisory_xact_lock/);
  assert.match(loader, /question_id,\s*provenance_version/);
  assert.doesNotMatch(loader, /'additive-loader'|SET\s+status\s*=\s*'approved'/i);
});

test('optional RLS uses ownership and avoids deprecated role checks', () => {
  assert.match(rls, /\(SELECT auth\.uid\(\)\)\s*=\s*user_id/);
  assert.match(rls, /WITH CHECK\s*\(\(SELECT auth\.uid\(\)\)\s*=\s*id\)/);
  assert.doesNotMatch(rls, /auth\.role\s*\(/);
  assert.doesNotMatch(rls, /FOR\s+INSERT\s*,\s*UPDATE/i);
});

test('active seed files contain no destructive statements', () => {
  const directory = path.join(root, 'seed');
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.sql'))) {
    const contents = fs.readFileSync(path.join(directory, file), 'utf8');
    assert.doesNotMatch(contents, /^\s*(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)/im, file);
  }
});

test('all expected verification and evidence-gate files exist', () => {
  for (const file of [
    'verification/01_staging_inventory.sql',
    'verification/02_evidence_integrity.sql',
    'verification/03_gate4_readiness.sql',
    'verification/04_security_audit.sql',
    'hardening/01_assessment_integrity.sql',
    'EVIDENCE-WORKFLOW.md',
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test('historical empty migrations remain preserved', () => {
  const directory = path.join(root, 'migrations');
  const empty = fs.readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .filter((name) => fs.statSync(path.join(directory, name)).size === 0);
  assert.equal(empty.length, 14);
});
