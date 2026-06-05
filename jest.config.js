/** @type {import('jest').Config} */
module.exports = {
  testEnvironment:       'jsdom',
  transform:             { '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }] },
  testMatch: [
    '**/tests/**/*.spec.js',
    '**/tests/**/*.test.js',
    '!**/tests/playwright/**'
  ],
  setupFiles:            ['<rootDir>/tests/jest-setup.js'],
  setupFilesAfterEnv:    ['<rootDir>/scripts/jest-setup-retries.js'],
  clearMocks:            true,
  restoreMocks:          true,
  // Ignore Playwright tests so Jest doesn't try to execute them
  testPathIgnorePatterns: ['/node_modules/', '/tests/playwright/'],
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
