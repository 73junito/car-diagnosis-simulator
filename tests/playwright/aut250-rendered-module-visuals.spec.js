const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://127.0.0.1:3012' });

test('AUT-250 module player renders three project-authored visuals', async ({ page }) => {
  await page.goto('/courses/aut-250/module/?module=aut250-m1-battery-systems');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('[data-visual-section]')).toBeVisible();
  await expect(page.locator('[data-module-visual]')).toHaveCount(3);
  await expect(page.locator('.module-visual-missing')).toHaveCount(0);
  await expect(page.getByText('Battery-system functional architecture', { exact: true })).toBeVisible();
  await expect(page.getByText('Measured, calculated, commanded, and inferred battery data', { exact: true })).toBeVisible();
  await expect(page.getByText('Battery evidence-to-next-check reasoning', { exact: true })).toBeVisible();
});
