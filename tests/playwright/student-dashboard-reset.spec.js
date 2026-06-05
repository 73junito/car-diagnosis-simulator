const { test, expect } = require('@playwright/test');

test('empty-filter then reset restores cards', async ({ page }) => {
  const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:3003/dashboard/student';
  // capture page errors and console.error messages for diagnosis
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
  await page.waitForSelector('.empty-state');
  const empty = await page.$('.empty-state');
  await expect(empty).toBeTruthy();

  // click the visible reset button to restore defaults (use DOM click to exercise attached listener)
  await page.evaluate(() => { const b = document.getElementById('resetFiltersBtn'); if(b) b.click(); });

  // dump diagnostic state immediately after click
  const debugState = await page.evaluate(() => ({
    searchValue: document.querySelector('#searchInput')?.value,
    categoryValue: document.querySelector('#filterCategory')?.value,
    registryLength: (window.SCENARIO_REGISTRY || []).length,
    cardCount: document.querySelectorAll('#scenarioGrid .sd-card').length,
    emptyStateVisible: !!document.querySelector('.empty-state')
  }));
  // emit to node console so trace/CI logs capture it
  console.log('reset-debug-state:', JSON.stringify({ debugState, pageErrors, consoleErrors }));

  // fail if page threw errors during render
  expect(pageErrors).toEqual([]);

  // now assert that cards re-appeared (use locator-based wait)
  const expected = debugState.registryLength || 17;
  await expect(page.locator('#scenarioGrid .sd-card')).toHaveCount(expected, { timeout: 15000 });
});
