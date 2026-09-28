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

    let assessmentQuestionRequestSeen = false;
    let requestedAttemptId = null;

    // Assessment mode now uses the server-bound attempt question endpoint.
    await page.route('**/api/assessment-attempts/*/questions', async (route) => {
      const url = new URL(route.request().url());
      const match = url.pathname.match(/\/api\/assessment-attempts\/([^/]+)\/questions$/);
      requestedAttemptId = match ? decodeURIComponent(match[1]) : null;
      assessmentQuestionRequestSeen = true;

      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Attempt has no assigned questions' })
      });
    });

    // STEP 2: Verify mocked API contract before navigation
    const apiResponse = await fetchMockedApi(
      page,
      '/api/scenario-questions-approved?scenario_id=no-crank'
    );
    expect(apiResponse.status).toBe(200);
    expect(apiResponse.json.questions).toHaveLength(0);
    console.log('✓ API contract verified: no-crank returns 200 with 0 questions (fail-closed)');

    // STEP 3: Provide a test auth token and navigate with a server-created attempt id.
    await page.addInitScript(() => {
      localStorage.setItem('supabase_access_token', 'playwright-test-token');
    });

    await page.goto(`${BASE_URL}/dashboard/student/scenario/?scenario=no-crank-clicking&mode=assessment&attempt_id=test-attempt-123`,
      { waitUntil: 'domcontentloaded', timeout: 30000 });

    // STEP 4: Verify assessment mode requested only the server-bound attempt question set.
    await page.waitForTimeout(500);
    expect(assessmentQuestionRequestSeen).toBe(true);
    expect(requestedAttemptId).toBe('test-attempt-123');
    console.log('✓ Assessment attempt question request intercepted: test-attempt-123');

    // STEP 5: Verify fail-closed state - no question cards render
    const questionCards = await page.locator('article.question-card').count();
    expect(questionCards).toBe(0);

    // STEP 6: Verify the new server-authoritative fail-closed message is displayed.
    await expect(page.getByRole('heading', { name: 'Assessment unavailable' })).toBeVisible();
    await expect(
      page.getByText('The server-assigned assessment question set is not available.')
    ).toBeVisible();

    console.log('✓ TTED805 no-crank assessment mode enforces fail-closed blocking');
    console.log('  - Scenario resolved: no-crank-clicking → no-crank (category)');
    console.log('  - Server-bound attempt question request made: yes');
    console.log('  - Question cards rendered: 0');
    console.log('  - User sees blocking message: yes');
  });
});
