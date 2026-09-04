const { test, expect } = require('@playwright/test');

test.describe('student dashboard keyboard accessibility', ()=>{

  test('Enter opens scenario page', async ({ page }) => {

    const BASE =
      process.env.PREVIEW_URL ||
      'http://127.0.0.1:3003/dashboard/student/';

    await page.goto(BASE, { waitUntil: 'networkidle' });

    // Find the first scenario card's "Start" button (for keyboard accessibility)
    const startButton = page.locator('article.tm-scenario-v2-card')
      .first()
      .locator('a.tm-btn-primary');

    await startButton.focus();
    await expect(startButton).toBeFocused();

    // Press Enter on the Start link to navigate to the scenario page
    // (following the canonical diagnostic workflow route)
    await page.keyboard.press('Enter');

    // Navigate to the scenario page via the canonical diagnostic workflow route
    await expect(page).toHaveURL(
      /\/dashboard\/student\/scenario\/\?scenario=/
    );
  });

});
