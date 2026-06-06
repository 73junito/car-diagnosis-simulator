const { test, expect } = require('@playwright/test');

test('empty-filter then reset restores cards', async ({ page }) => {
  const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:3003/dashboard/student';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // ensure filters cleared
  await page.fill('#searchInput','');
  await page.selectOption('#filterCategory','all');
  await page.waitForTimeout(100);

  // type impossible search
  await page.fill('#searchInput', 'no-match-possible-xyz');
  await page.dispatchEvent('#searchInput', 'input');
  await page.waitForSelector('.empty-state');
  const empty = await page.$('.empty-state');
  await expect(empty).toBeTruthy();
  await expect(page.locator('#scenarioFilters #resetFiltersBtn')).toBeVisible();

  // click the visible reset button to restore defaults
  await page.click('#resetFiltersBtn');
  // wait for cards to re-appear (increase timeout to account for CI/slower environments)
  await page.waitForSelector('#scenarioGrid .sd-card', { timeout: 10000 });
  const cards = await page.$$('#scenarioGrid .sd-card');
  expect(cards.length).toBeGreaterThan(0);
});
