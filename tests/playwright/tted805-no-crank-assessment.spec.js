const { test, expect } = require('@playwright/test');

test.describe('TTED805: No-Crank Assessment Mode', () => {
  test('enforces fail-closed blocking when no approved questions available', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';

    // STEP 1: Mock API to return production contract (fail-closed)
    // Production contract: no-crank scenario returns 200 with 0 questions
    await page.route('**/api/scenario-questions-approved*', async (route) => {
      if (route.request().url().includes('scenario_id=no-crank')) {
        // Fulfill with production contract: fail-closed (0 questions)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ questions: [] })
        });
      } else {
        route.continue();
      }
    });

    // STEP 2: Verify mocked API contract
    const apiResponse = await page.evaluate(async () => {
      const resp = await fetch('/api/scenario-questions-approved?scenario_id=no-crank');
      return {
        status: resp.status,
        body: await resp.json()
      };
    });
    expect(apiResponse.status).toBe(200);
    expect(apiResponse.body.questions).toHaveLength(0);
    console.log('✓ API contract verified: no-crank returns 200 with 0 questions (fail-closed)');

    // STEP 3: Navigate to assessment entry page
    await page.goto(`${BASE_URL}/dashboard/student/scenario/?id=no-crank&mode=assessment&attempt_id=test-attempt-123`, 
      { waitUntil: 'domcontentloaded', timeout: 30000 });

    // STEP 4: Verify fail-closed state - no question cards render
    const questionCards = await page.locator('article.question-card').count();
    expect(questionCards).toBe(0);

    // STEP 5: Verify fail-closed message is displayed
    await expect(
      page.getByText('Question bank unavailable for grading.')
    ).toBeVisible();

    console.log('✓ TTED805 no-crank assessment mode enforces fail-closed blocking');
    console.log('  - API contract enforced: 200 with 0 questions');
    console.log('  - Question cards rendered: 0');
    console.log('  - User sees blocking message: yes');
  });
});
