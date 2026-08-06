const { test } = require('@playwright/test');
const fs = require('fs');

const storageState = 'playwright/.auth/user.json';
const isCi = process.env.CI === 'true';

// If storage state already exists, skip interactive setup to avoid popping a browser.
test.skip(fs.existsSync(storageState), 'Playwright auth storage exists; skip interactive setup');
// Never run interactive auth setup in CI.
test.skip(isCi, 'Interactive authentication is not run in CI.');

// This interactive setup saves an authenticated storage state to
// `playwright/.auth/user.json`. Run this locally and complete the login manually
// (or automate via env vars if you prefer). Do NOT commit the resulting JSON.
test('authenticate and save storage state', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'https://app.autolearnpro.com';
  await page.goto(base, { waitUntil: 'networkidle' });

  console.log('Interactive auth setup: please complete login in the opened browser.');

  // Wait for the authenticated landing page to appear (student dashboard).
  // This is more reliable than a fixed timeout. Increase the regex if needed.
  await page.waitForURL(/\/dashboard\/student\/?/, { timeout: 5 * 60 * 1000 });

  // Basic sanity check that the page rendered
  await page.waitForSelector('body');

  // Ensure directory exists and save storage state
  await page.context().storageState({ path: storageState });
});
