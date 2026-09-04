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

    // Press Enter on the button to activate the scenario
    await page.keyboard.press('Enter');

    // Scenario opens in-panel, so URL has ?scenario= param on dashboard
    await expect(page).toHaveURL(
      /\/dashboard\/student\/\?scenario=/
    );

    // Back to dashboard button should be visible when scenario detail is open
    await expect(
      page.getByRole('button', { name: /back to dashboard/i })
    ).toBeVisible();
  });

});
