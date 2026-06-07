const { test, expect } = require('@playwright/test');

test('empty-filter then reset restores cards', async ({ page }) => {
  const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:3003/dashboard/student';
  // capture page errors and console.error messages
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err && err.message ? err.message : String(err));
  });
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // ensure filters cleared
  await page.fill('#searchInput','');
  await page.selectOption('#filterCategory','all');
  await page.waitForTimeout(100);

  // type impossible search
  await page.fill('#searchInput', 'no-match-possible-xyz');
  await page.dispatchEvent('#searchInput', 'input');
  await expect(page.locator('.empty-state')).toBeVisible();

  // click the visible reset button to restore defaults
  await page.locator('#resetFiltersBtn').scrollIntoViewIfNeeded();
  await expect(page.locator('#resetFiltersBtn')).toBeVisible();
  await expect(page.locator('#resetFiltersBtn')).toBeEnabled();
  await page.locator('#resetFiltersBtn').click();

  // wait for the page to signal that grid rendering completed via the `grid:rendered` event
  await page.evaluate(() => new Promise(resolve => {
    if (document.querySelector('#scenarioGrid .sd-card')) { resolve(); return; }
    window.addEventListener('grid:rendered', resolve, { once: true });
  }));

  // intermediate assertions: inputs cleared
  await expect(page.locator('#searchInput')).toHaveValue('');
  await expect(page.locator('#filterCategory')).toHaveValue('all');

  // ensure no runtime errors or console errors were emitted
  expect(pageErrors).toEqual([]);
  const meaningfulConsoleErrors = consoleErrors.filter(e => !e.includes('favicon'));
  expect(meaningfulConsoleErrors).toEqual([]);

  // ensure empty-state is gone
  await expect(page.locator('.empty-state')).toBeHidden();

  // verify some cards are present after reset (allow for incremental render timing)
  const registryLength = await page.evaluate(() => (window.SCENARIO_REGISTRY || []).length);
  expect(registryLength).toBeGreaterThan(0);
  // ensure at least one card is present and the empty-state is gone
  await expect(page.locator('#scenarioGrid .sd-card').first()).toBeVisible({ timeout: 15000 });
});
