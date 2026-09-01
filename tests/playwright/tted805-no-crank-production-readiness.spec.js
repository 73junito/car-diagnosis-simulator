const { test, expect } = require('@playwright/test');

test.describe('TTED805: Production-Ready Citation Validation', () => {
  test('renders 3 deterministically validated questions (Frontiers-backed after IJERT rollback)', async ({ page, request }) => {
    // Step 1: Verify API returns 3 questions with valid deterministic citations
    // Note: IJERT questions were removed to enforce fail-closed evidence policy.
    // Only Frontiers-backed questions remain (status: validated).
    const response = await request.get('/api/scenario-questions-approved?scenario_id=no-crank');

    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    expect(payload.questions).toHaveLength(3);

    // Each question must have deterministically validated citations
    for (const question of payload.questions) {
      expect(question.question_provenance.status).toBe('approved');

      // CRITICAL: citation_validation.valid must be true (requires deterministic validator)
      expect(
        question.question_provenance.citation_validation.valid,
        `Question ${question.question_key} must have valid=true from deterministic validator`
      ).toBe(true);

      expect(question.citations.length).toBeGreaterThan(0);
    }

    // Step 2: Verify no answer keys in API response
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/"correct_answer"|"correctAnswer"/);

    // Step 3: Navigate to dashboard and verify 3 question cards render
    await page.goto('/dashboard/student/scenario/?id=no-crank&mode=training');

    // All 3 questions must render (not fail-closed)
    await expect(page.locator('article.question-card')).toHaveCount(3);

    // "Question bank unavailable" message should NOT appear
    await expect(
      page.getByText('Question bank unavailable for grading')
    ).toHaveCount(0);
  });
});
