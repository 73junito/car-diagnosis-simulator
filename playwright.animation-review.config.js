const base = require('./playwright.config.js')

module.exports = {
  ...base,
  testDir: 'tests/animation-review',
  testMatch: /starting-system-review-harness\.spec\.js/,
  projects: [
    {
      name: 'chromium',
      use: {
        ...base.projects.find((project) => project.name === 'chromium').use,
        baseURL: 'http://127.0.0.1:3013',
        storageState: undefined,
      },
    },
  ],
  webServer: {
    command: 'npx http-server -p 3013 -c-1 review-dist',
    url: 'http://127.0.0.1:3013',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
}
