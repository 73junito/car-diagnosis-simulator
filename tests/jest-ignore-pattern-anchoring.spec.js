/** @jest-environment node */
/**
 * Regression contract for jest.config.js `testPathIgnorePatterns`.
 *
 * Jest matches these patterns against ABSOLUTE, forward-slash-normalized
 * paths. An unanchored `supabase/tests/` therefore also matches any checkout
 * directory whose name ends in `-supabase` followed by its own `tests/`
 * folder (e.g. F:\TorqueMind-curriculum-supabase\tests\foo.spec.js), which
 * silently ignores the ENTIRE Jest suite ("No tests found").
 *
 * The pattern must be anchored to a real path-segment boundary so only the
 * repository's own supabase/tests directory is ignored.
 */
const path = require('path');

const config = require('../jest.config.js');
const patterns = config.testPathIgnorePatterns;

const isIgnored = (absolutePath) => {
  // Jest normalizes to forward slashes before matching.
  const normalized = absolutePath.replace(/\\/g, '/');
  return patterns.some((pattern) => new RegExp(pattern).test(normalized));
};

describe('Jest testPathIgnorePatterns anchoring', () => {
  test('ignores the repository supabase/tests directory', () => {
    const repoRoot = path.resolve(__dirname, '..').replace(/\\/g, '/');

    expect(isIgnored(`${repoRoot}/supabase/tests/security-contracts.test.js`)).toBe(true);
    expect(isIgnored(`${repoRoot}/supabase/tests/package-integrity.test.js`)).toBe(true);
  });

  test('does not ignore tests under a checkout directory ending in -supabase', () => {
    // Regression: this path was previously swallowed by 'supabase/tests/'.
    expect(isIgnored('F:/TorqueMind-curriculum-supabase/tests/foo.spec.js')).toBe(false);
    expect(isIgnored('F:/anything-supabase/tests/foo.spec.js')).toBe(false);
    expect(isIgnored('C:/work/my-supabase/tests/nested.spec.js')).toBe(false);
  });

  test('still ignores nested directories literally named supabase/tests', () => {
    expect(isIgnored('F:/arbitrary/prefix/supabase/tests/foo.test.js')).toBe(true);
  });

  test('keeps the ordinary repository test suite visible', () => {
    const repoRoot = path.resolve(__dirname, '..').replace(/\\/g, '/');

    expect(isIgnored(`${repoRoot}/tests/worker-curriculum-read.test.js`)).toBe(false);
    expect(isIgnored(`${repoRoot}/tests/smoke.spec.js`)).toBe(false);
    expect(isIgnored(`${repoRoot}/supabase/migrations/foo.sql`)).toBe(false);
  });

  test('preserves the playwright ignore rule', () => {
    const repoRoot = path.resolve(__dirname, '..').replace(/\\/g, '/');

    expect(isIgnored(`${repoRoot}/tests/playwright/some.spec.js`)).toBe(true);
    expect(isIgnored(`${repoRoot}/node_modules/pkg/index.test.js`)).toBe(true);
  });
});
