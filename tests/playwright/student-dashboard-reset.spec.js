const { test, expect } = require('@playwright/test');

test('empty-filter then reset restores cards', async ({ page }) => {
  const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:3003/dashboard/student/';

  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', err => {
    pageErrors.push(err?.message || String(err));
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Start from a known state
  await page.fill('#searchInput', '');
  await page.selectOption('#filterCategory', 'all');

  // Force empty results
  await page.fill('#searchInput', 'no-match-possible-xyz');
  await page.dispatchEvent('#searchInput', 'input');

  // Verify empty state appears
  await expect(page.locator('.empty-state')).toBeVisible();

  // Use the Reset button inside the empty-state section
  const resetButton = page
    .locator('#scenarioGrid')
    .getByRole('button', { name: 'Reset filters' });

  await expect(resetButton).toBeVisible();
  await expect(resetButton).toBeEnabled();

  await resetButton.click();

  // Verify filters reset
  await expect(page.locator('#searchInput')).toHaveValue('', {
    timeout: 15000
  });

  await expect(page.locator('#filterCategory')).toHaveValue('all', {
    timeout: 15000
  });

  // Empty state should disappear
  await expect(page.locator('.empty-state')).toBeHidden({
    timeout: 15000
  });

  // Cards should return
  await expect(
    page.locator('#scenarioGrid .sd-card').first()
  ).toBeVisible({
    timeout: 15000
  });

  const registryLength = await page.evaluate(
    () => (window.SCENARIO_REGISTRY || []).length
  );

  expect(registryLength).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  const meaningfulConsoleErrors = consoleErrors.filter(
    error => !error.includes('favicon')
  );

  expect(meaningfulConsoleErrors).toEqual([]);
});