const { test, expect } = require('@playwright/test');

test.describe('TTED805: Fail-Closed Citation Validation', () => {
  test('renders zero question cards when citation validation missing', async ({ page }) => {
    // Current state: API returns 20 questions but all have citation_validation.valid = false
    // (because citation_validations table is empty or not populated by validator)

    // Navigate to scenario - this will fetch questions from API
    await page.goto('/dashboard/student/scenario/?id=no-crank&mode=training');

    // CRITICAL VERIFY: No question cards render (dashboard correctly implements fail-closed)
    // Questions are filtered at dashboard layer when citation_validation.valid != true
    const cardCount = await page.locator('article.question-card').count();
    expect(cardCount).toBe(0);

    console.log('✅ Fail-closed test passed: zero questions rendered when citation_validation.valid = false');
  });
});
