const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://127.0.0.1:3012' });

test.describe('AUT-250 guided question player', () => {
  test('shows one question at a time with structured reasoning feedback and gated navigation', async ({ page }) => {
    await page.goto('/courses/aut-250/module/?module=aut250-m1-battery-systems');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('data-aut250-player-release', 'approved-for-training-use');
    await expect(page.locator('[data-question-position]')).toHaveText('Question 1 of 4');
    await expect(page.locator('[data-question-card]')).toHaveCount(1);
    await expect(page.locator('[data-submit-answer]')).toBeDisabled();
    await expect(page.locator('[data-retry-answer]')).toBeHidden();
    await expect(page.locator('[data-next-question]')).toBeDisabled();
    await expect(page.locator('[data-reasoning-step].is-active')).toHaveCount(1);

    await page.locator('input[name="guided-question"][value="B"]').check();
    await expect(page.locator('[data-submit-answer]')).toBeEnabled();
    await page.locator('[data-submit-answer]').click();

    await expect(page.locator('[data-question-feedback]')).toContainText('Result');
    await expect(page.locator('[data-question-feedback]')).toContainText('Correct');
    await expect(page.locator('[data-question-feedback]')).toContainText('Why');
    await expect(page.locator('[data-question-feedback]')).toContainText('Diagnostic takeaway');
    await expect(page.locator('[data-question-feedback]')).toContainText('does not authorize a vehicle service action');
    await expect(page.locator('[data-next-question]')).toBeEnabled();

    await page.locator('[data-next-question]').click();
    await expect(page.locator('[data-question-position]')).toHaveText('Question 2 of 4');
  });

  test('fails closed if approval is unavailable', async ({ page }) => {
    await page.route('**/data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    );
    await page.goto('/courses/aut-250/module/?module=aut250-m1-battery-systems');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('data-aut250-player-release', 'blocked');
    await expect(page.locator('[data-question-player]')).toBeHidden();
    await expect(page.locator('#player-gate-blocked')).toBeVisible();
  });
});
