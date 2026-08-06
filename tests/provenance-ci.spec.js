const fs = require('fs');
const path = require('path');

describe('provenance CI gates (local fixtures)', () => {
  const fixturesSql = fs.readFileSync(path.resolve(__dirname, '..', 'db', 'fixtures', 'provenance_fixtures.sql'), 'utf8');

  test('fixtures include approved source and chunk', () => {
    expect(fixturesSql).toMatch(/INSERT INTO public.approved_sources/);
    expect(fixturesSql).toMatch(/fixture-approved-source/);
    expect(fixturesSql).toMatch(/INSERT INTO public.source_chunks/);
    expect(fixturesSql).toMatch(/fixture-approved-chunk/);
  });

  test('approved question has both answer and explanation citations', () => {
    // ensure we have two citation inserts for the approved question
    const citMatches = fixturesSql.match(/INSERT INTO public.question_citations/g) || [];
    expect(citMatches.length).toBeGreaterThanOrEqual(2);
    expect(fixturesSql).toMatch(/supports-answer/);
    expect(fixturesSql).toMatch(/supports-explanation/);
  });

  test('invalid fixture present for missing citations', () => {
    expect(fixturesSql).toMatch(/fixture-invalid-missing-citations/);
  });

  test('approved checksum and chunk hash look like SHA-256', () => {
    const sha64 = /[a-f0-9]{64}/;
    expect(fixturesSql).toMatch(new RegExp("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
    expect(fixturesSql.match(sha64)).toBeTruthy();
  });

  test('fixture definitions are unique (by created entity)', () => {
    const defs = [];
    const insertRegex = /INSERT INTO public\.(approved_sources|source_chunks|question_provenance)\s*\([^)]*\)\s*VALUES\s*\(\s*'([^']+)'/g;
    let m;
    while ((m = insertRegex.exec(fixturesSql)) !== null) {
      defs.push({ table: m[1], id: m[2] });
    }
    const keys = defs.map(d => `${d.table}::${d.id}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  test('chunk locator is non-empty for approved chunk', () => {
    expect(fixturesSql).toMatch(/'A6 > Starting System > Starter Circuit Testing'/);
  });

  test('migration enables RLS and includes status transition guard', () => {
    const mig = fs.readFileSync(path.resolve(__dirname, '..', 'db', 'migrations', '20260805_approved_sources_large_chunks.sql'), 'utf8');
    expect(mig).toMatch(/enable row level security/);
    expect(mig).toMatch(/Invalid provenance transition/);
  });

  test('provenance_audit is append-only (no update/delete policy)', () => {
    const mig = fs.readFileSync(path.resolve(__dirname, '..', 'db', 'migrations', '20260805_approved_sources_large_chunks.sql'), 'utf8');
    // ensure there is an insert policy but no update or delete policy for provenance_audit
    expect(mig).toMatch(/create policy provenance_audit_insert_reviewers/);
    // no explicit update/delete policy names for provenance_audit
    expect(mig).not.toMatch(/create policy .*provenance_audit.*for update/);
    expect(mig).not.toMatch(/create policy .*provenance_audit.*for delete/);
  });

  test('migration contains helper role-check functions', () => {
    const mig = fs.readFileSync(path.resolve(__dirname, '..', 'db', 'migrations', '20260805_approved_sources_large_chunks.sql'), 'utf8');
    expect(mig).toMatch(/create or replace function public.is_provenance_reviewer/);
    expect(mig).toMatch(/create or replace function public.is_provenance_admin/);
  });
});
