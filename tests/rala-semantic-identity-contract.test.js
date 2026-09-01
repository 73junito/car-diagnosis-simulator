const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('RALA tooling joins provenance with the stable semantic question_id', () => {
  const inventory = read('scripts/rala-question-inventory.ps1');
  const missing = read('scripts/rala_d_missing_provenance.sql');

  assert.doesNotMatch(inventory, /qp\.question_id\s*=\s*sq\.id::text/i);
  assert.doesNotMatch(missing, /qp\.question_id\s*=\s*sq\.id::text/i);
  assert.match(inventory, /qp\.question_id\s*=\s*sq\.question_id/i);
  assert.match(missing, /qp\.question_id\s*=\s*sq\.question_id/i);
});

test('pilot selection exports semantic IDs instead of database UUIDs', () => {
  const selector = read('scripts/rala-select-pilot-questions.ps1');

  assert.match(selector, /question_id\s*=\s*\$Row\.question_id/);
  assert.doesNotMatch(selector, /question_id\s*=\s*\$Row\.id/);
  assert.match(selector, /without a semantic question_id/);
});

test('student answers retain the internal UUID foreign key', () => {
  const migration = read(
    'supabase/migrations/20260817012716_create_attempt_answers.sql'
  );

  assert.match(
    migration,
    /question_id\s+uuid\s+not null\s+references public\.scenario_questions\(id\)/is
  );
});
