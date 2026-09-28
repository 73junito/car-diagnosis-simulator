const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://127.0.0.1:3012' });

test('AUT-250 reasoning model stays visible on dashboard and player', async ({ page }) => {
  await page.goto('/courses/aut-250/');
  const dashboardStrip = page.locator('.diagnostic-reasoning-strip');
  await expect(dashboardStrip).toBeVisible();
  await expect(dashboardStrip.locator('li')).toHaveCount(5);
  await expect(page.getByText('Request → Measure → Compare → Correlate → Verify', { exact: true })).toBeVisible();

  await page.goto('/courses/aut-250/module/?module=aut250-m1-battery-systems');
  const playerStrip = page.locator('.diagnostic-reasoning-strip');
  await expect(playerStrip).toBeVisible();
  await expect(playerStrip.locator('li')).toHaveCount(5);
  await expect(page.getByText('Project-authored reasoning model', { exact: true })).toBeVisible();
});
