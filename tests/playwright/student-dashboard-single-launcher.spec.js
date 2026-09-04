import { test, expect } from '@playwright/test';

test.describe('Student Dashboard - Single Scenario Launcher', () => {
  test('uses scenario cards as the only student scenario launcher', async ({ page }) => {
    await page.goto('/dashboard/student/', { waitUntil: 'domcontentloaded' });

    // SHOULD PASS: Browse Scenarios anchor points to card grid
    await expect(page.getByRole('link', { name: 'Browse Scenarios', exact: true }))
      .toHaveAttribute('href', '#scenarioGridSection');

    // SHOULD PASS: Available Scenarios heading visible
    await expect(page.getByRole('heading', { name: 'Available Scenarios', exact: true }))
      .toBeVisible();

    // SHOULD PASS: exactly 21 cards present (catches duplicate-card regressions)
    await expect(page.locator('article.tm-scenario-v2-card'))
      .toHaveCount(21);

    // SHOULD FAIL (initially, PASS after map removal): No map image
    await expect(page.locator('img[alt="Scenario dashboard map"]'))
      .toHaveCount(0);

    // SHOULD FAIL (initially, PASS after map removal): No hotspot buttons
    await expect(page.locator('button[data-scenario]'))
      .toHaveCount(0);
  });
});
