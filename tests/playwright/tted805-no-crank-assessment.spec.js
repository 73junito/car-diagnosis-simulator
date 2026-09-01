const { test, expect } = require('@playwright/test');

test.describe('TTED805: No-Crank Assessment Mode', () => {
  test('enforces fail-closed blocking when no approved questions available', async ({ page, request }) => {
    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';

    // STEP 1: Verify API returns 0 approved questions (fail-closed)
    const response = await request.get('/api/scenario-questions-approved?scenario_id=no-crank');
    
    // API should return an error when no approved questions exist
    expect(response.status()).not.toBe(200);

    // STEP 2: Navigate to assessment entry page
    await page.goto(`${BASE_URL}/dashboard/student/scenario/?id=no-crank&mode=assessment&attempt_id=test-attempt-123`, 
      { waitUntil: 'domcontentloaded', timeout: 30000 });

    // STEP 3: Verify fail-closed state - no question cards render
    const questionCards = await page.locator('article.question-card').count();
    expect(questionCards).toBe(0);

    // STEP 4: Verify fail-closed message is displayed
    await expect(
      page.getByText('Question bank unavailable for grading.')
    ).toBeVisible();

    console.log('✓ TTED805 no-crank assessment mode enforces fail-closed blocking');
    console.log('  - API returns error: yes (no approved questions)');
    console.log('  - Question cards rendered: 0');
    console.log('  - User sees blocking message: yes');
  });
});
