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
  await expect(page.locator('.empty-state')).toBeVisible();

  // diagnostic: capture button bounding box and full-page screenshot before click
  const btnBox = await page.locator('#resetFiltersBtn').boundingBox();
  console.log('reset-button-box:', JSON.stringify(btnBox));
  await page.screenshot({ path: 'test-results/reset-before-click.png', fullPage: true });

  // click the visible reset button to restore defaults (use Playwright click)
  try {
    await page.locator('#resetFiltersBtn').click();
  } catch (err) {
    // capture diagnostics on click failure
    console.log('reset-click-error:', String(err));
    await page.screenshot({ path: 'test-results/reset-click-failed.png', fullPage: true });
    throw err;
  }

  // capture post-click screenshot for diagnosis
  await page.screenshot({ path: 'test-results/reset-after-click.png', fullPage: true });

  // dump diagnostic state immediately after click
  const debugState = await page.evaluate(() => ({
    searchValue: document.querySelector('#searchInput')?.value,
    categoryValue: document.querySelector('#filterCategory')?.value,
    registryLength: (window.SCENARIO_REGISTRY || []).length,
    cardCount: document.querySelectorAll('#scenarioGrid .sd-card').length,
    emptyStateVisible: !!document.querySelector('.empty-state'),
    resetButtons: Array.from(document.querySelectorAll('#resetFiltersBtn')).map(b => ({ outer: b.outerHTML }))
  }));
  console.log('reset-debug-state:', JSON.stringify({ debugState, pageErrors, consoleErrors }));

  // intermediate assertions: inputs cleared
  await expect(page.locator('#searchInput')).toHaveValue('');
  await expect(page.locator('#filterCategory')).toHaveValue('all');

  // ensure no runtime errors or console errors were emitted
  expect(pageErrors).toEqual([]);
  // filter harmless messages if needed
  const meaningfulConsoleErrors = consoleErrors.filter(e => !e.includes('favicon'));
  expect(meaningfulConsoleErrors).toEqual([]);

  // ensure empty-state is gone
  await expect(page.locator('.empty-state')).toBeHidden();

  // verify registry length and card count match
  const registryLength = await page.evaluate(() => (window.SCENARIO_REGISTRY || []).length);
  expect(registryLength).toBeGreaterThan(0);
  await expect(page.locator('#scenarioGrid .sd-card')).toHaveCount(registryLength, { timeout: 15000 });
});
