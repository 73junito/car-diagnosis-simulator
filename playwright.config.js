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
// Remote authentication is opt-in only; it is not authorized by CI=true.
const remoteAuthOptIn = process.env.PLAYWRIGHT_REMOTE_AUTH === 'true';
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
    // The interactive auth setup project is registered ONLY when remote
    // authentication is explicitly opted in. Without PLAYWRIGHT_REMOTE_AUTH=true
    // an unrestricted `npx playwright test` cannot select it because the project
    // does not exist. auth.setup.js enforces the same gate itself, so an explicit
    // `--project=setup` cannot bypass it either.
    ...(remoteAuthOptIn
      ? [
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
        ]
      : []),
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
    : [
        {
          command: 'npx http-server -p 3003 -c-1 .',
          url: 'http://127.0.0.1:3003',
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
        {
          // Exam site (learning path) uses root-absolute asset paths, so it
          // needs a server rooted at exam-site/ rather than the repo root.
          command: 'npx http-server -p 3012 -c-1 exam-site',
          url: 'http://127.0.0.1:3012',
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
      ],
};