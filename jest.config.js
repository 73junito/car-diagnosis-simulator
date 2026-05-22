/** @type {import('jest').Config} */
module.exports = {
  testEnvironment:       'jsdom',
  transform:             { '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }] },
  testMatch:             ['**/tests/**/*.spec.js'],
  setupFiles:            ['<rootDir>/tests/jest-setup.js'],
  setupFilesAfterEnv:    ['<rootDir>/tests/jest-setup.js'],
  clearMocks:            true,
  restoreMocks:          true,
};
