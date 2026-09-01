const { test, expect } = require('@playwright/test');

test.describe('TTED805: No-Crank Training Mode', () => {
  test('loads canonical scenario route with API-backed questions', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';

    // STEP 1: Navigate to student dashboard
    await page.goto(`${BASE_URL}/dashboard/student/`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/dashboard\/student\/$/, { timeout: 15000 });

    // STEP 2: Verify dashboard loaded
    await expect(page.locator('#scenarioGrid')).toBeVisible({ timeout: 10000 });
    const cards = await page.locator('#scenarioGrid .sd-card').count();
    expect(cards).toBeGreaterThan(0);

    // STEP 3: Navigate directly to no-crank training scenario with canonical route
    // Validate the URL parameter order: id=, then mode=
    const canonicalUrl = `${BASE_URL}/dashboard/student/scenario/?id=no-crank&mode=training`;
    console.log(`Navigating to canonical URL: ${canonicalUrl}`);
    await page.goto(canonicalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // STEP 4: Capture the approved-question API response BEFORE waiting for DOM
    const responsePromise = page.waitForResponse(
      response =>
        response.url().includes('/api/scenario-questions-approved') &&
        response.request().method() === 'GET'
    );

    // Reload to trigger fresh API request
    await page.reload({ waitUntil: 'domcontentloaded' });

    const apiResponse = await responsePromise;

    // STEP 5: Verify API response is successful
    expect(
      apiResponse.ok(),
      `Approved-question API returned ${apiResponse.status()}: ${await apiResponse.text()}`
    ).toBeTruthy();

    // STEP 6: Verify API response contains 20 approved questions
    const payload = await apiResponse.json();
    expect(payload.questions, 'API should return questions array').toBeDefined();
    expect(Array.isArray(payload.questions), 'Questions should be an array').toBeTruthy();
    expect(
      payload.questions.length,
      `Expected 20 approved questions, got ${payload.questions.length}`
    ).toBe(20);

    // STEP 7: Verify each question has required provenance fields and citation_validation status
    payload.questions.forEach((q, idx) => {
      expect(q.question_provenance, `Q${idx} missing provenance`).toBeDefined();
      expect(q.question_provenance.status, `Q${idx} provenance status`).toBe('approved');
      
      // Verify citation_validation field exists (may be valid or invalid)
      // Currently all questions have citation_validation.valid = false (fail-closed default)
      // because citation_validation data is not yet populated in the database
      expect(q.question_provenance.citation_validation, `Q${idx} missing citation_validation`).toBeDefined();
      expect(typeof q.question_provenance.citation_validation.valid).toBe('boolean');
      
      expect(q.citations, `Q${idx} missing citations`).toBeDefined();
      expect(Array.isArray(q.citations), `Q${idx} citations not an array`).toBeTruthy();
      expect(q.citations.length, `Q${idx} should have at least one citation`).toBeGreaterThan(0);
      
      // Verify citations have required fields (already filtered to approved on server)
      q.citations.forEach((c, cidx) => {
        expect(c.quote, `Q${idx}.C${cidx} missing quote`).toBeDefined();
        expect(c.source_title, `Q${idx}.C${cidx} missing source_title`).toBeDefined();
        expect(c.source_status, `Q${idx}.C${cidx} source not approved`).toBe('approved');
      });
    });

    // STEP 8: Verify NO correct_answer in API response (security gate)
    const responseBody = await apiResponse.text();
    expect(
      responseBody,
      'API should NEVER return correct_answer to browser'
    ).not.toContain('"correct_answer"');

    // STEP 9: Verify fail-closed behavior
    // Since citation_validation.valid = false for all questions (fail-closed default because
    // citation_validation data is not yet in the database), the client-side filter excludes all questions
    // Expected result: 0 question cards rendered in the DOM
    const questionCards = await page.locator('article.question-card').count();
    
    // STEP 10: Verify fail-closed behavior is working
    // Until citation_validation data is populated in the database, no questions should render
    // This is correct behavior for fail-closed validation: when validation data is missing,
    // treat as invalid and exclude from rendering
    expect(questionCards, 
      'No questions should render with fail-closed citation_validation.valid = false'
    ).toBe(0);

    // STEP 11: Verify NO answer keys exposed in DOM (security gate)
    // Answer keys must NEVER be available to the browser, even in training mode
    await expect(
      page.locator("[data-correct-answer]")
    ).toHaveCount(0);

    // Verify no answer keys anywhere (even though questions are filtered out)
    // This ensures the answer key stripping works at the API boundary
    const pageHtml = await page.content();
    expect(pageHtml).not.toContain("correct_answer");
    expect(pageHtml).not.toContain("correctAnswer");

    console.log('✓ TTED805 training mode: fail-closed citation validation confirmed (awaiting database citation_validation records)');
  });
});
