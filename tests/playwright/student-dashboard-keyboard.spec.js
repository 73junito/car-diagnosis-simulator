const { test, expect } = require('@playwright/test');

test.describe('student dashboard keyboard accessibility', ()=>{
  test('Enter/Space open detail, Escape closes, focus returns', async ({ page }) => {
    const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:3003/dashboard/student';
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const selector = '.hotspot[data-scenario="no-crank"]';
    await page.waitForSelector(selector);
    const hotspot = page.locator(selector);
    await hotspot.focus();
    await expect(hotspot).toBeFocused();

    // Enter opens
    await page.keyboard.press('Enter');
    const back = page.locator('#backBtn');
    await expect(back).toBeVisible();
    await expect(back).toBeFocused();

    // Escape closes and focus returns
    await page.keyboard.press('Escape');
    await expect(hotspot).toBeFocused();

    // Space opens
    await page.keyboard.press('Space');
    await expect(back).toBeVisible();
    await expect(back).toBeFocused();

    // Close via back button
    await back.press('Enter');
    await expect(page.locator('#detail')).toHaveClass(/hidden/);
  });
});
