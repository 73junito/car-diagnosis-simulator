/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  transform:       { '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }] },
  testMatch:       ['**/tests/**/*.spec.js'],
  clearMocks:      true,
  restoreMocks:    true,
};
