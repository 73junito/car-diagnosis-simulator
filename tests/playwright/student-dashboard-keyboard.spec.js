const { test, expect } = require('@playwright/test');

test.describe('student dashboard keyboard accessibility', ()=>{

  test('Enter opens scenario page', async ({ page }) => {

    const BASE =
      process.env.PREVIEW_URL ||
      'http://127.0.0.1:3003/dashboard/student';

    await page.goto(BASE, { waitUntil: 'networkidle' });

    const hotspot =
      page.locator('.hotspot[data-scenario="no-crank"]');

    await hotspot.focus();
    await expect(hotspot).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(
      /\/dashboard\/student\/scenario\/\?id=no-crank/
    );

    await expect(
      page.getByRole('link', { name: /back to dashboard/i })
    ).toBeVisible();
  });

});
