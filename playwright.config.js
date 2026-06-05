// @ts-check
const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: 'tests/playwright',
  testMatch: ['**/*.spec.js', '**/*.test.js'],
  forbidOnly: !!process.env.CI,
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'test-results/playwright-report' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 0,
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
};
