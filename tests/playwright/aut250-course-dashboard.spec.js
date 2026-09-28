const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3012' });

test.describe('AUT-250 learner course dashboard', () => {
  test('renders six approved modules with browser-only progress', async ({ page }) => {
    await page.goto('/courses/aut-250/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('data-aut250-course-release', 'approved-for-training-use');
    await expect(page.locator('[data-dashboard-module]')).toHaveCount(6);
    await expect(page.locator('[data-course-release-status]')).toContainText('Approved for formative training use');
    await expect(page.locator('[data-course-progress]')).toHaveText('0 / 6');

    await page.locator('[data-toggle-module]').first().click();
    await expect(page.locator('[data-course-progress]')).toHaveText('1 / 6');
  });

  test('fails closed if the final approval credential cannot be verified', async ({ page }) => {
    await page.route('**/data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    );

    await page.goto('/courses/aut-250/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('data-aut250-course-release', 'blocked');
    await expect(page.locator('[data-dashboard-module]')).toHaveCount(0);
    await expect(page.locator('#course-gate-blocked')).toBeVisible();
    await expect(page.locator('[data-course-continue]')).toHaveAttribute('aria-disabled', 'true');
  });
});
