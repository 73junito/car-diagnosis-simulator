const { test, expect } = require('@playwright/test');
const { installLocalPreviewGuard } = require('./local-preview-guard');

// This suite drives the student scenario dashboard, which is served from the
// repository root on port 3003 (exam-site/ on 3012 has no /dashboard/ route).
// Port 3003 is approved for THIS suite only — the shared guard default stays 3012.
const APPROVED_ORIGINS = ['http://127.0.0.1:3003'];
const ASSESSMENT_QUESTIONS_GLOB = '**/api/assessment-attempts/*/questions';

test.describe('TTED805: No-Crank Assessment Mode', () => {
  let guard;

  // Installed before any mock: Playwright matches routes last-registered-first,
  // so the mock wins for the assessment endpoint and the guard covers the rest.
  test.beforeEach(async ({ page }) => {
    guard = await installLocalPreviewGuard(page, { approvedOrigins: APPROVED_ORIGINS });
  });

  test('enforces fail-closed blocking when no approved questions available', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';

    let assessmentQuestionRequestSeen = false;
    let requestedAttemptId = null;
    // Deterministic record proving the intended fixture — not an accidental 404 —
    // supplied the response that drives the fail-closed UI below.
    const fixture = { fulfilled: [] };

    // Assessment mode now uses the server-bound attempt question endpoint.
    await guard.mock(ASSESSMENT_QUESTIONS_GLOB, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const match = url.pathname.match(/\/api\/assessment-attempts\/([^/]+)\/questions$/);
      requestedAttemptId = match ? decodeURIComponent(match[1]) : null;
      assessmentQuestionRequestSeen = true;

      fixture.fulfilled.push({ url: request.url(), method: request.method(), status: 409 });

      // Injected failure fixture (409), intentionally served locally.
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Attempt has no assigned questions' })
      });
    });

    // STEP 2: Provide a test auth token and navigate with a server-created attempt id.
    await page.addInitScript(() => {
      localStorage.setItem('supabase_access_token', 'playwright-test-token');
    });

    await page.goto(`${BASE_URL}/dashboard/student/scenario/?scenario=no-crank-clicking&mode=assessment&attempt_id=test-attempt-123`,
      { waitUntil: 'domcontentloaded', timeout: 30000 });

    // STEP 3: Verify assessment mode requested only the server-bound attempt question set.
    // Deterministic wait on the fixture instead of a fixed sleep.
    await expect.poll(() => fixture.fulfilled.length, { timeout: 15000 }).toBe(1);
    expect(assessmentQuestionRequestSeen).toBe(true);
    expect(requestedAttemptId).toBe('test-attempt-123');

    // Prove the local fixture is what the page received: correct endpoint, GET, and
    // the injected 409 — not a 404 from the static file server.
    expect(fixture.fulfilled[0].url).toContain('/api/assessment-attempts/test-attempt-123/questions');
    expect(fixture.fulfilled[0].method).toBe('GET');
    expect(fixture.fulfilled[0].status).toBe(409);

    console.log('✓ Assessment attempt question request intercepted: test-attempt-123');

    // STEP 4: Verify fail-closed state - no question cards render
    const questionCards = await page.locator('article.question-card').count();
    expect(questionCards).toBe(0);

    // STEP 5: Verify the new server-authoritative fail-closed message is displayed.
    await expect(page.getByRole('heading', { name: 'Assessment unavailable' })).toBeVisible();
    await expect(
      page.getByText('The server-assigned assessment question set is not available.')
    ).toBeVisible();

    // This flow must remain read-only: the guard recorded no attempt to reach any
    // destination outside the approved local origin.
    expect(guard.blockedDestinations, 'no unexpected external destinations').toEqual([]);

    console.log('✓ TTED805 no-crank assessment mode enforces fail-closed blocking');
    console.log('  - Scenario resolved: no-crank-clicking → no-crank (category)');
    console.log('  - Server-bound attempt question request made: yes');
    console.log('  - Question cards rendered: 0');
    console.log('  - User sees blocking message: yes');
  });
});
