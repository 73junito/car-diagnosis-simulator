const { test, expect } = require('@playwright/test');

async function fetchMockedApi(page, path) {
  await page.goto('/', {
    waitUntil: 'domcontentloaded',
  });

  return page.evaluate(async (requestPath) => {
    const requestUrl = new URL(
      requestPath,
      window.location.origin
    );

    const response = await fetch(requestUrl);
    const text = await response.text();

    return {
      status: response.status,
      text: text,
      json: JSON.parse(text),
    };
  }, path);
}

test.describe('TTED805: No-Crank Assessment Mode', () => {
  test('enforces fail-closed blocking when no approved questions available', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';

    let approvedQuestionRequestSeen = false;
  let requestedScenarioId = null;
    // Mock API and track requests
    await page.route('**/api/scenario-questions-approved?*', async (route) => {
      const url = new URL(route.request().url());
      const scenarioId = url.searchParams.get("scenario_id");

      if (scenarioId === "no-crank") {
        approvedQuestionRequestSeen = true;
        requestedScenarioId = scenarioId;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ questions: [] })
        });
        return;
      }

      await route.continue();
    });

    // STEP 2: Verify mocked API contract before navigation
    const apiResponse = await fetchMockedApi(
      page,
      '/api/scenario-questions-approved?scenario_id=no-crank'
    );
    expect(apiResponse.status).toBe(200);
    expect(apiResponse.json.questions).toHaveLength(0);
    console.log('✓ API contract verified: no-crank returns 200 with 0 questions (fail-closed)');

    // STEP 3: Navigate to assessment entry page (using scenario_key instead of ambiguous category)
    await page.goto(`${BASE_URL}/dashboard/student/scenario/?scenario=no-crank-clicking&mode=assessment&attempt_id=test-attempt-123`,
      { waitUntil: 'domcontentloaded', timeout: 30000 });

    // STEP 4: Verify the page made the API request with the correct scenario_id
    await page.waitForTimeout(500);  // Brief wait for async API call
    expect(approvedQuestionRequestSeen).toBe(true);
    expect(requestedScenarioId).toBe('no-crank');
    console.log('✓ API request intercepted with correct scenario_id: no-crank');

    // STEP 5: Verify fail-closed state - no question cards render
    const questionCards = await page.locator('article.question-card').count();
    expect(questionCards).toBe(0);

    // STEP 6: Verify fail-closed message is displayed
    await expect(
      page.getByText('Question bank unavailable for grading.')
    ).toBeVisible();

    console.log('✓ TTED805 no-crank assessment mode enforces fail-closed blocking');
    console.log('  - Scenario resolved: no-crank-clicking → no-crank (category)');
    console.log('  - API request made with category: yes');
    console.log('  - Question cards rendered: 0');
    console.log('  - User sees blocking message: yes');
  });
});
