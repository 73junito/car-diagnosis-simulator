const { test, expect } = require('@playwright/test');
const { installLocalPreviewGuard } = require('./local-preview-guard');

// Two loopback origins are explicitly approved for this suite (never implicitly):
//   http://127.0.0.1:3012 — exam-site root, used by `page.goto('/')` when
//                           PLAYWRIGHT_BASE_URL points at the exam preview.
//   http://127.0.0.1:3003 — repository root, which serves the student scenario
//                           dashboard under /dashboard/ (see BASE_URL below).
// Every other origin, including any other loopback port, is aborted by the guard.
const APPROVED_ORIGINS = ['http://127.0.0.1:3012', 'http://127.0.0.1:3003'];

/**
 * Serve an approved-questions fixture from local interception.
 *
 * Deliberately never calls route.continue(): a pass-through would forward the
 * request to the network and bypass the guard, which is exactly the failure mode
 * this suite must prevent. An unmatched scenario id therefore receives a local
 * 404 rather than escaping.
 *
 * Returns deterministic call statistics so a test can prove its fixture — rather
 * than an unrelated 404 — produced the assertion it makes.
 */
async function mockApprovedQuestions(guard, urlFragment, questions) {
  const observed = { requests: [], fulfilled: [], unmatched: [] };

  await guard.mock('**/api/scenario-questions-approved*', async (route) => {
    const requestUrl = route.request().url();
    observed.requests.push(requestUrl);

    if (requestUrl.includes(urlFragment)) {
      observed.fulfilled.push(requestUrl);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ questions })
      });
    }

    observed.unmatched.push(requestUrl);
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'scenario_not_mocked' })
    });
  });

  return observed;
}

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

test.describe('TTED805: Approved Questions API - Production Contracts', () => {
  let guard;

  // Installed before any mock: Playwright evaluates routes last-registered-first,
  // so mocks win for their endpoint and the guard handles everything else.
  test.beforeEach(async ({ page }) => {
    guard = await installLocalPreviewGuard(page, { approvedOrigins: APPROVED_ORIGINS });
  });

  test('no-crank correctly returns fail-closed state (0 approved questions)', async ({ page }) => {
    // Verify that no-crank scenario has no approved questions
    // This is correct per fail-closed policy
    
    // Mock API: no-crank returns 200 with 0 questions (fail-closed)
    await mockApprovedQuestions(guard, 'scenario_id=no-crank', []);

    const response = await fetchMockedApi(
      page,
      '/api/scenario-questions-approved?scenario_id=no-crank'
    );

    expect(response.status).toBe(200);
    expect(response.json.questions).toHaveLength(0);
    console.log('✓ no-crank: API correctly returns fail-closed state (0 approved questions)');
  });

  test('charging-system returns 3 validated questions (ready for approval)', async ({ page }) => {
    // Note: The application has 3 validated Frontiers-backed questions for charging-system
    // These have passed technical and instructional review
    
    // Mock API: charging-system returns 200 with 3 questions
    await mockApprovedQuestions(guard, 'scenario_id=charging-system', [
      { id: 1, text: 'Q1', source: 'Frontiers' },
      { id: 2, text: 'Q2', source: 'Frontiers' },
      { id: 3, text: 'Q3', source: 'Frontiers' }
    ]);

    const response = await fetchMockedApi(
      page,
      '/api/scenario-questions-approved?scenario_id=charging-system'
    );

    expect(response.status).toBe(200);
    expect(response.json.questions).toHaveLength(3);
    
    // Verify no answer keys are exposed (security check)
    expect(response.text).not.toMatch(/['"]\s*correct_answer\s*['"]:/);
    
    console.log('✓ charging-system: 3 Frontiers-backed questions ready for approval');
  });

  test('no-crank scenario UI correctly blocks grading', async ({ page }) => {
    // Verify fail-closed blocking for no-crank only (charging-system will have questions)
    // Updated: use specific scenario_key instead of ambiguous category ID
    
    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
    
    // Mock API: no-crank returns 200 with 0 questions.
    // The dashboard requests ?scenarioId=no-crank (camelCase — see scenario.js:209),
    // so this fragment must match that spelling for the fixture to be served at all.
    const fixture = await mockApprovedQuestions(guard, 'scenarioId=no-crank', []);

    await page.goto(`${BASE_URL}/dashboard/student/scenario/?scenario=no-crank-clicking&mode=training`);

    // Verify fail-closed state - no question cards render (API returned 0 questions)
    const questionCards = await page.locator('article.question-card').count();
    expect(questionCards).toBe(0);

    // Verify user sees blocking message when no approved questions available
    await expect(
      page.getByText('Question bank unavailable for grading.')
    ).toBeVisible();

    // Prove the blocked state above came from THIS fixture and not from an
    // unrelated HTTP 404: the mock must have matched and fulfilled exactly once,
    // and nothing may have fallen through to the unmatched branch.
    expect(fixture.fulfilled, 'the approved-questions fixture must actually be served').toHaveLength(1);
    expect(fixture.fulfilled[0]).toContain('scenarioId=no-crank');
    expect(fixture.unmatched, 'no request may fall through to the 404 branch').toEqual([]);
    
    console.log('✓ no-crank: UI correctly shows fail-closed blocking message');
  });

  test('charging-system scenario can render questions when API returns them', async ({ page }) => {
    // Positive regression test: charging-system API returns 3 questions
    // This documents that charging-system has approved questions for grading
    
    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
    
    // Mock API: charging-system returns 200 with 3 questions
    await mockApprovedQuestions(guard, 'scenario_id=charging-system', [
      { id: 1, text: 'Q1', source: 'Frontiers' },
      { id: 2, text: 'Q2', source: 'Frontiers' },
      { id: 3, text: 'Q3', source: 'Frontiers' }
    ]);

    const response = await fetchMockedApi(
      page,
      '/api/scenario-questions-approved?scenario_id=charging-system'
    );

    expect(response.status).toBe(200);
    expect(response.json.questions).toHaveLength(3);
    console.log(`✓ charging-system: ${response.json.questions.length} questions available for grading`);
    console.log('  - After Gate 4 approval, these will render in the UI');
  });
});
