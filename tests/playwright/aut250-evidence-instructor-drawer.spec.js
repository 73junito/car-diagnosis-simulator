const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://127.0.0.1:3012' });

test('AUT-250 evidence drawer exposes governance details without answer keys', async ({ page }) => {
  await page.goto('/courses/aut-250/module/?module=aut250-m1-battery-systems');
  await page.waitForLoadState('networkidle');

  await page.locator('[data-evidence-drawer-open]').click();
  const drawer = page.locator('[data-evidence-drawer]');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Metadata-only citation proof', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Valid', { exact: true })).toBeVisible();
  await expect(drawer.getByText(/rights · technical · instructional · safety/i)).toBeVisible();
  await expect(drawer.getByText(/Battery access, isolation, measurement, PPE, wait times/i)).toBeVisible();
  await expect(drawer.locator('.evidence-question-list article')).toHaveCount(8);
  await expect(drawer.getByText(/Answer keys are intentionally not shown/)).toBeVisible();
  await expect(drawer).not.toContainText('Calculated values may depend on models and multiple inputs');

  await page.locator('[data-evidence-drawer-close]').click();
  await expect(drawer).not.toBeVisible();
});
