// @ts-check

const { devices } = require('@playwright/test');

// Resolve baseURL from env, defaulting to a local preview server
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  'http://127.0.0.1:4173';

const isRemoteBaseUrl = /^https?:\/\//i.test(baseURL)
  && !baseURL.includes('127.0.0.1')
  && !baseURL.includes('localhost');

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';

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
    baseURL,
    viewport: {
      width: 1280,
      height: 800,
    },
    actionTimeout: 0,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      retries: 0,
      use: {
        headless: false,
        baseURL,
      },
    },
    {
      name: 'chromium',
      testIgnore: /public-homepage\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL,
        // Use authenticated storage state produced by the `setup` step
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'public-chromium',
      testMatch: /public-homepage\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.PUBLIC_SITE_BASE_URL || 'http://127.0.0.1:4174',
        storageState: undefined,
      },
    },
  ],

  webServer: (isRemoteBaseUrl || skipWebServer)
    ? undefined
    : {
        command: 'npm run preview',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },
};