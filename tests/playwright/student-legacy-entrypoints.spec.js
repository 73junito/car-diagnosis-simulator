const { test, expect } = require('@playwright/test');

test.describe('Student legacy entrypoints', () => {
  for (const legacyPath of [
    '/dashboard/student.html',
    '/dashboard/student/student.html'
  ]) {
    test(`${legacyPath} redirects to the canonical student dashboard`, async ({ page }) => {
      await page.goto(legacyPath);
      await expect(page).toHaveURL(/\/dashboard\/student\/$/);
      const cards = page.locator('article.tm-scenario-v2-card');
      await expect(cards).toHaveCount(6);
      await page.getByRole('button', { name: 'Show all scenarios' }).click();
      await expect(cards).toHaveCount(21);
    });

    test(`${legacyPath} preserves scenario query parameter in redirect`, async ({ page }) => {
      await page.goto(
        '/dashboard/student.html?scenario=no-crank-clicking'
      );
      await expect(page).toHaveURL(
        /\/dashboard\/student\/\?scenario=no-crank-clicking/
      );
    });
  }
});
