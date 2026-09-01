/** @type {import('jest').Config} */
try { console.log('[JEST CONFIG LOADED]') } catch (e) {}
module.exports = {
  testEnvironment:       'jsdom',
  transform:             { '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }] },
  testMatch: [
    '**/tests/**/*.spec.js',
    '**/tests/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/playwright/',
    'supabase/tests/',
    'rala-semantic-identity-contract'
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
