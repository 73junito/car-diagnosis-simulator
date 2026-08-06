// @ts-check

const fs = require('fs');
const { devices } = require('@playwright/test');

// Resolve baseURL from env, defaulting to a local preview server
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  'http://127.0.0.1:3003';

const isRemoteBaseUrl = /^https?:\/\//i.test(baseURL)
  && !baseURL.includes('127.0.0.1')
  && !baseURL.includes('localhost');

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';
const enablePublicProject = Boolean(process.env.PUBLIC_SITE_BASE_URL);
const isCi = process.env.CI === 'true';
const authStoragePath = 'playwright/.auth/user.json';
const authStorageState = fs.existsSync(authStoragePath) ? authStoragePath : undefined;

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
        // Headed browsers fail in Linux CI without X server.
        headless: isCi,
        baseURL,
      },
    },
    {
      name: 'chromium',
      testIgnore: [
        /public-homepage\.spec\.js/,
        /auth\.setup\.js/,
      ],
      use: {
        ...devices['Desktop Chrome'],
        baseURL,
        // Use auth state when available; default CI/local smoke remains unauthenticated.
        storageState: authStorageState,
      },
    },
    ...(enablePublicProject
      ? [
          {
            name: 'public-chromium',
            testMatch: /public-homepage\.spec\.js/,
            use: {
              ...devices['Desktop Chrome'],
              baseURL: process.env.PUBLIC_SITE_BASE_URL,
              storageState: undefined,
            },
          },
        ]
      : []),
  ],

  webServer: (isRemoteBaseUrl || skipWebServer)
    ? undefined
    : {
        command: 'npx http-server -p 3003 -c-1 .',
        url: 'http://127.0.0.1:3003',
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },
};