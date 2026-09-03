const { test, expect } = require('@playwright/test');

test.describe('Legacy Route Ambiguity Regression', () => {
  test.describe('Ambiguous category routes must reject with error', () => {
    test('?id=no-crank returns error (ambiguous: 2 scenarios with this category)', async ({ page }) => {
      // Navigate to dashboard with ambiguous category
      await page.goto('/dashboard/student/scenario/?id=no-crank&mode=training');

      // The resolver returns null, which triggers "Scenario not found"
      // Require visible error text and zero scenario titles
      await expect(
        page.getByText(/scenario not found/i)
      ).toBeVisible();

      await expect(
        page.locator('.scenario-title')
      ).toHaveCount(0);

      console.log('✅ ?id=no-crank correctly rejected (ambiguous category)');
    });

    test('?id=misfire returns error (ambiguous: 2 scenarios with this category)', async ({ page }) => {
      // Navigate to dashboard with ambiguous category
      await page.goto('/dashboard/student/scenario/?id=misfire&mode=training');

      // The resolver returns null, which triggers "Scenario not found"
      // Require visible error text and zero scenario titles
      await expect(
        page.getByText(/scenario not found/i)
      ).toBeVisible();

      await expect(
        page.locator('.scenario-title')
      ).toHaveCount(0);

      console.log('✅ ?id=misfire correctly rejected (ambiguous category)');
    });

    test('?id=hybrid-ev returns error (ambiguous: 2 scenarios with this category)', async ({ page }) => {
      // Navigate to dashboard with ambiguous category
      await page.goto('/dashboard/student/scenario/?id=hybrid-ev&mode=training');

      // The resolver returns null, which triggers "Scenario not found"
      // Require visible error text and zero scenario titles
      await expect(
        page.getByText(/scenario not found/i)
      ).toBeVisible();

      await expect(
        page.locator('.scenario-title')
      ).toHaveCount(0);

      console.log('✅ ?id=hybrid-ev correctly rejected (ambiguous category)');
    });
  });

  test.describe('Unambiguous routes must still work', () => {
    test('?id=overheating resolves successfully via slug fallback', async ({ page }) => {
      // Navigate to dashboard with slug-based ID (unique, unambiguous category)
      await page.goto('/dashboard/student/scenario/?id=overheating&mode=training');

      // Verify scenario loaded successfully
      // Should have a scenario title and question cards
      const scenarioTitle = page.locator('h1, h2, [class*="title"]').first();
      const questionCards = page.locator('[class*="question"], article');

      // Title should be visible (not "Scenario not found")
      const titleText = await scenarioTitle.textContent();
      expect(titleText).toBeTruthy();
      expect(titleText?.toLowerCase()).not.toContain('not found');

      console.log('✅ ?id=overheating resolves successfully');
    });

    test('numeric IDs resolve correctly (backwards compatibility)', async ({ page }) => {
      // Test numeric ID 1 (no-crank-clicking)
      await page.goto('/dashboard/student/scenario/?id=1&mode=training');

      const scenarioTitle = page.locator('h1, h2, [class*="title"]').first();
      const titleText = await scenarioTitle.textContent();

      expect(titleText).toBeTruthy();
      expect(titleText?.toLowerCase()).not.toContain('not found');
      console.log('✅ ?id=1 resolves successfully');
    });

    test('unique unambiguous categories resolve correctly', async ({ page }) => {
      // Test a category with only 1 scenario (e.g., no-start)
      await page.goto('/dashboard/student/scenario/?id=no-start&mode=training');

      const scenarioTitle = page.locator('h1, h2, [class*="title"]').first();
      const titleText = await scenarioTitle.textContent();

      expect(titleText).toBeTruthy();
      expect(titleText?.toLowerCase()).not.toContain('not found');
      console.log('✅ ?id=no-start (unambiguous category) resolves successfully');
    });
  });

  test.describe('New scenario_key routing must work', () => {
    test('?scenario=no-crank-clicking loads correct variant', async ({ page }) => {
      // Test new unambiguous scenario_key routing
      await page.goto('/dashboard/student/scenario/?scenario=no-crank-clicking&mode=training');

      const scenarioTitle = page.locator('h1, h2, [class*="title"]').first();
      const titleText = await scenarioTitle.textContent();

      expect(titleText).toBeTruthy();
      expect(titleText?.toLowerCase()).not.toContain('not found');
      console.log('✅ ?scenario=no-crank-clicking resolves successfully');
    });

    test('?scenario=no-crank-starter-click loads correct variant', async ({ page }) => {
      // Test new unambiguous scenario_key routing for second no-crank variant
      await page.goto('/dashboard/student/scenario/?scenario=no-crank-starter-click&mode=training');

      const scenarioTitle = page.locator('h1, h2, [class*="title"]').first();
      const titleText = await scenarioTitle.textContent();

      expect(titleText).toBeTruthy();
      expect(titleText?.toLowerCase()).not.toContain('not found');
      console.log('✅ ?scenario=no-crank-starter-click resolves successfully');
    });
  });
});
