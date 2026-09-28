const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3012' });

test.describe('AUT-250 learner course dashboard', () => {
  test('renders six approved modules with participation-based browser progress', async ({ page }) => {
    await page.goto('/courses/aut-250/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('data-aut250-course-release', 'approved-for-training-use');
    await expect(page.locator('[data-dashboard-module]')).toHaveCount(6);
    await expect(page.locator('[data-dashboard-module="aut250-m1-battery-systems"]')).toContainText('8 training questions');
    await expect(page.locator('[data-dashboard-module="aut250-m2-power-electronics"]')).toContainText('8 training questions');
    await expect(page.locator('[data-course-release-status]')).toContainText('Approved for formative training use');
    await expect(page.locator('[data-course-progress]')).toHaveText('0 / 6');
    await expect(page.locator('[data-progress-attempted]')).toHaveText('0 / 40');
    await expect(page.locator('[data-toggle-module]')).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem('autolearnpro:aut250:module-progress', JSON.stringify({
      version: 2,
      lastModuleId: 'aut250-m1-battery-systems',
      modules: {
        'aut250-m1-battery-systems': {
          currentQuestionIndex: 3,
          attemptedQuestionIds: ['aut250-m1-q01','aut250-m1-q02','aut250-m1-q03','aut250-m1-q04'],
          feedbackViewedQuestionIds: ['aut250-m1-q01','aut250-m1-q02','aut250-m1-q03','aut250-m1-q04'],
          completed: true,
          lastVisitedAt: '2026-09-28T00:00:00.000Z'
        }
      }
    })));
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-course-progress]')).toHaveText('0 / 6');
    await expect(page.locator('[data-progress-attempted]')).toHaveText('4 / 40');
    await expect(page.locator('[data-dashboard-module="aut250-m1-battery-systems"] .aut250-module-status')).toHaveText('In progress');
    await expect(page.locator('[data-course-continue]')).toContainText('Continue Module 01');
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

  test('fails closed if the Batch 002 approval credential cannot be verified', async ({ page }) => {
    await page.route('**/data/evidence/approval-records/aut250-training-batch-002-final-approval-20260928.json', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    );

    await page.goto('/courses/aut-250/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('data-aut250-course-release', 'blocked');
    await expect(page.locator('[data-dashboard-module]')).toHaveCount(0);
    await expect(page.locator('#course-gate-blocked')).toBeVisible();
  });

});
