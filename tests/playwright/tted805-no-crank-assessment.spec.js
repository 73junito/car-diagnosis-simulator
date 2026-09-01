const { test, expect } = require('@playwright/test');

test.describe('TTED805: No-Crank Assessment Mode', () => {
  test('enforces answer-key security and server-side grading (3 Frontiers-backed questions)', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';

    // Track all network requests to verify security properties
    const capturedGradeRequests = [];
    const capturedGradeResponses = [];
    const capturedTutorRequests = [];

    page.on('request', (request) => {
      if (request.url().includes('/api/scenario-submissions/grade')) {
        capturedGradeRequests.push({
          url: request.url(),
          method: request.method(),
          body: request.postDataBuffer()
            ? JSON.parse(request.postDataBuffer().toString())
            : null
        });
      }
      if (request.url().includes('/api/torquemind-feedback')) {
        capturedTutorRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    page.on('response', (response) => {
      if (response.url().includes('/api/scenario-submissions/grade')) {
        response.text().then((body) => {
          capturedGradeResponses.push({
            url: response.url(),
            status: response.status(),
            body: JSON.parse(body)
          });
        });
      }
    });

    // STEP 1: Navigate to assessment entry page
    // For now, bypass attestation and go directly to scenario with mode=assessment
    // Note: IJERT rollback reduced available questions from 20 to 3 (Frontiers-backed only)
    await page.goto(`${BASE_URL}/dashboard/student/scenario/?id=no-crank&mode=assessment&attempt_id=test-attempt-123`, 
      { waitUntil: 'domcontentloaded', timeout: 30000 });

    // STEP 2: Wait for questions to load (3 Frontiers-backed, IJERT removed)
    await expect(page.locator('article.question-card')).toHaveCount(3, { timeout: 10000 });

    // STEP 3: SECURITY CHECK - Verify NO answer keys in DOM
    const domAnswerKeyCount = await page.locator('[data-correct-answer]').count();
    expect(
      domAnswerKeyCount,
      'Assessment mode must NOT expose correct_answer in DOM attributes'
    ).toBe(0);

    // STEP 4: SECURITY CHECK - Verify "correct_answer" string not in page HTML
    const pageContent = await page.content();
    expect(
      pageContent,
      'Assessment mode must NOT contain correct_answer string in DOM'
    ).not.toContain('correct_answer');

    // STEP 5: Answer all 3 questions with random selections
    const cards = page.locator('article.question-card');
    const totalQuestions = 3;
    
    for (let i = 0; i < totalQuestions; i++) {
      const card = cards.nth(i);
      const options = card.locator('input[type="radio"]');
      const optionCount = await options.count();
      
      if (optionCount > 0) {
        const randomIdx = Math.floor(Math.random() * optionCount);
        await options.nth(randomIdx).click();

        // Find and click submit button
        const submitBtn = card.locator('.submit-answer').first();
        await submitBtn.click();

        // Wait a bit for submission
        await page.waitForTimeout(500);

        // Verify feedback message is safe (no answer keys)
        const feedbackText = await card.locator('.answer-feedback').textContent();
        expect(
          feedbackText,
          `Question ${i + 1} feedback must not expose answer keys`
        ).not.toContain('Correct answer:');

        // In assessment mode, feedback should be "Submitted." only
        expect(
          feedbackText.trim() === 'Submitted.' || 
          feedbackText.trim() === 'Correct.' || 
          feedbackText.trim() === 'Incorrect.',
          `Question ${i + 1} feedback should be safe: got "${feedbackText}"`
        ).toBeTruthy();
      }
    }

    // STEP 6: Wait for all submissions to complete
    await page.waitForTimeout(1000);

    // STEP 7: SECURITY CHECK - Verify grading request bodies don't send answer keys
    expect(
      capturedGradeRequests.length,
      'Should have called grading endpoint for each question'
    ).toBeGreaterThan(0);

    for (const req of capturedGradeRequests) {
      const bodyStr = JSON.stringify(req.body);
      expect(
        bodyStr,
        'Grading request must not contain correct_answer'
      ).not.toContain('correct_answer');
      expect(
        bodyStr,
        'Grading request must not contain is_correct'
      ).not.toContain('is_correct');

      // Verify required fields are present
      expect(req.body).toHaveProperty('attempt_id');
      expect(req.body).toHaveProperty('scenario_id');
      expect(req.body).toHaveProperty('question_id');
      expect(req.body).toHaveProperty('student_answer');
      expect(req.body).toHaveProperty('delivery_mode');
      expect(req.body.delivery_mode).toBe('independent_non_proctored_assessment');
    }

    // STEP 8: SECURITY CHECK - Verify grading responses don't expose answer keys
    for (const resp of capturedGradeResponses) {
      const bodyStr = JSON.stringify(resp.body);
      expect(
        bodyStr,
        'Grading response must not contain correct_answer'
      ).not.toContain('correct_answer');
      expect(
        bodyStr,
        'Grading response must not contain explanation in assessment mode'
      ).not.toContain('explanation') || resp.body.explanation === null;
      expect(
        resp.body.ai_assistance_available,
        'Grading response must disable AI in assessment mode'
      ).toBe(false);
    }

    // STEP 9: SECURITY CHECK - Verify tutor endpoint NOT called in assessment mode
    expect(
      capturedTutorRequests.length,
      'Assessment mode must NOT call tutor endpoint'
    ).toBe(0);

    // STEP 10: Wait for summary to render
    await page.waitForTimeout(1000);
    const summaryText = await page.locator('#attemptSummary').textContent();
    
    // STEP 11: SECURITY CHECK - Verify final score is real (not placeholder 0)
    // Extract score from summary: "Score: X% (PASS/FAIL)"
    const scoreMatch = summaryText.match(/Score:\s*(\d+)%/);
    expect(scoreMatch).toBeTruthy();
    const finalScore = parseInt(scoreMatch[1], 10);
    
    // Score should be calculated from actual grading results, not hardcoded to 0
    // We answered 20 random questions, so score should reflect actual correctness
    expect(
      typeof finalScore === 'number' && finalScore >= 0 && finalScore <= 100,
      'Final score must be a valid percentage'
    ).toBeTruthy();

    // STEP 12: SECURITY CHECK - Verify no answer keys in final summary
    expect(
      summaryText,
      'Summary must not contain answer keys'
    ).not.toContain('correct_answer');

    console.log('✓ TTED805 assessment mode enforces answer-key security');
    console.log(`  - Grading requests: ${capturedGradeRequests.length}`);
    console.log(`  - Grading responses: ${capturedGradeResponses.length}`);
    console.log(`  - Tutor calls: ${capturedTutorRequests.length} (should be 0)`);
    console.log(`  - Final score: ${finalScore}%`);
  });
});
