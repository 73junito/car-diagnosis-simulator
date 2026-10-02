import { test, expect } from '@playwright/test';

test.describe('Student Dashboard - Single Scenario Launcher', () => {
  test('uses scenario cards as the only student scenario launcher', async ({ page }) => {
    await page.goto('/dashboard/student/', { waitUntil: 'domcontentloaded' });

    // Primary browse action points to the scenario grid.
    await expect(page.getByRole('link', { name: 'Choose a Scenario', exact: true }))
      .toHaveAttribute('href', '#scenarioGridSection');

    await expect(page.getByRole('heading', { name: 'Choose a scenario', exact: true }))
      .toBeVisible();

    // The student lands on a compact six-card view, with all scenarios one action away.
    const cards = page.locator('article.tm-scenario-v2-card');
    await expect(cards).toHaveCount(6);
    await page.getByRole('button', { name: 'Show all scenarios' }).click();
    await expect(cards).toHaveCount(21);

    // SHOULD FAIL (initially, PASS after map removal): No map image
    await expect(page.locator('img[alt="Scenario dashboard map"]'))
      .toHaveCount(0);

    // SHOULD FAIL (initially, PASS after map removal): No hotspot buttons
    await expect(page.locator('button[data-scenario]'))
      .toHaveCount(0);
  });
});
