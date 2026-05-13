/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jsdom',
  transform:       { '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }] },
  testMatch:       ['**/tests/**/*.spec.js'],
  clearMocks:      true,
  restoreMocks:    true,
};
