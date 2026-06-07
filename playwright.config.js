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
  // keep HTML report outside of the `test-results` root to avoid folder-clearing collisions
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 0,
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
  ,
  webServer: {
    command: 'npx http-server -p 3003 -c-1 .',
    url: 'http://127.0.0.1:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  }
};
