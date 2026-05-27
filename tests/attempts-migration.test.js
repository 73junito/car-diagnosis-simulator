/** @jest-environment node */
const fs = require('fs');
const path = require('path');

describe('Attempts migration SQL', () => {
  test('migration file exists and contains expected statements', () => {
    const p = path.resolve(process.cwd(), 'db/migrations/002_create_attempts.sql');
    const sql = fs.readFileSync(p, 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+public\.attempts/i);
    expect(sql).toMatch(/user_id uuid/i);
    expect(sql).toMatch(/payload_json jsonb/i);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/CREATE POLICY/i);
  });
});
