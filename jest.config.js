/** @type {import('jest').Config} */
try { console.log('[JEST CONFIG LOADED]') } catch (e) {}
module.exports = {
  testEnvironment:       'jsdom',
  transform:             { '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }], '^.+\\.ts$': '<rootDir>/scripts/jest-transform-ts.js' },
  testMatch: [
    '**/tests/**/*.spec.js',
    '**/tests/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/playwright/',
    '/tests/animation-review/',
    // Node's built-in test runner owns these contracts; Jest cannot discover node:test cases.
    '/tests/lmf-(?!foundation\\.test\\.js|runtime-coverage\\.test\\.js)[^/]+\\.test\\.js$',
    // Anchored to a path-segment boundary: Jest matches absolute, forward-slash
    // normalized paths, so an unanchored 'supabase/tests/' would also ignore any
    // checkout directory ending in '-supabase' plus its own tests/ folder.
    '^(.*)/supabase/tests/',
    // Git worktrees checked out inside a repository directory (for example
    // 'wt-<name>/') contain their own copy of 'tests/', so the '**/tests/**'
    // testMatch glob above collects duplicate, stale suites that belong to a
    // different checkout. Anchored and directory-scoped for the same reason as
    // the supabase pattern. This narrows discovery only; it does not skip,
    // relax, or alter any assertion, reporter, timeout, or CI requirement.
    '^(.*)/wt-[^/]+/tests/'
  ],
  // Ensure undici register runs before any test imports that may require Request/fetch.
  setupFiles:            ['<rootDir>/tests/jest-undici-register.js', '<rootDir>/tests/jest-setup.js'],
  setupFilesAfterEnv:    ['<rootDir>/scripts/jest-setup-retries.js'],
  clearMocks:            true,
  restoreMocks:          true,
  testTimeout: 30000,
  testRunner: 'jest-circus/runner',
  reporters: [
    'default',
    [
      'jest-junit',
      { outputDirectory: 'test-results', outputName: 'junit.xml' }
    ],
  ],
};
