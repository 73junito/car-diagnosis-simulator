// @ts-check

const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: 'tests/playwright',

  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },

  retries: 0,

  use: {
    headless: true,
    viewport: {
      width: 1280,
      height: 800,
    },
    actionTimeout: 0,
    trace: 'on-first-retry',
  },

  reporter: process.env.CI
    ? [
        ['list'],
        ['json'],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report' }],
      ],

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: {
    command: 'npx http-server -p 3003 -c-1 .',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
};