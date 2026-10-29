const { test, expect } = require('@playwright/test');
const { installLocalPreviewGuard, sanitizeUrl } = require('./local-preview-guard');

const LOCAL = 'http://127.0.0.1:3012';
const PROD_ENDPOINT = 'https://app.autolearnpro.com/api/curriculum';

// Every assertion below inspects interception outcomes; the guard aborts before
// any real network access, so no production host is contacted by these tests.
async function navigationOutcome(page, url) {
  try {
    const response = await page.goto(url);
    return { navigated: true, status: response && response.status() };
  } catch (err) {
    return { navigated: false, error: err.message };
  }
}

/**
 * Attempt a navigation on its own page with its own guard.
 *
 * A blocked navigation leaves the page sitting on Chromium's error document, and on
 * slower (CI) runners that error-page commit can race a later navigation on the same
 * page:
 *
 *   page.goto: Navigation to "http://127.0.0.1:3012/catalog/" is interrupted by
 *   another navigation to "chrome-error://chromewebdata/"
 *
 * Isolating each blocked attempt keeps the same security assertions while removing
 * the timing dependency entirely.
 */
async function probeBlockedNavigation(context, url, options) {
  const probePage = await context.newPage();
  try {
    const guard = await installLocalPreviewGuard(probePage, options);
    const outcome = await navigationOutcome(probePage, url);
    return { outcome, guard };
  } finally {
    await probePage.close();
  }
}

test.describe('local preview network guard', () => {
  test('allows approved local exam-site requests', async ({ page }) => {
    const guard = await installLocalPreviewGuard(page);
    // A page that only requests same-origin resources (AUT-250 dashboard).
    const response = await page.goto(LOCAL + '/courses/aut-250/');
    expect(response && response.status()).toBe(200);
    expect(guard.blockedDestinations).toEqual([]);
    expect(guard.approvedOrigins).toEqual([LOCAL]);
    expect(guard.allowedDestinations.length).toBeGreaterThan(0);
  });

  test('blocks unmatched production requests', async ({ page, context }) => {
    // Negative control on a dedicated page, so the aborted navigation's error document
    // cannot race the successful local navigation below.
    const blocked = await probeBlockedNavigation(context, 'https://app.autolearnpro.com/');
    expect(blocked.outcome.navigated, 'production navigation must be blocked').toBe(false);
    expect(blocked.guard.blockedDestinations).toContain('https://app.autolearnpro.com/');

    // Realistic case: the local catalog page itself requests the production
    // curriculum endpoint, so an unmocked run records the blocked attempt while
    // still rendering from its static fallback.
    const guard = await installLocalPreviewGuard(page);
    const catalog = await page.goto(LOCAL + '/catalog/');
    expect(catalog && catalog.status()).toBe(200);
    expect(guard.blockedDestinations).toContain('https://app.autolearnpro.com/api/curriculum');
  });

  test('fulfils an explicitly mocked endpoint locally', async ({ page }) => {
    const guard = await installLocalPreviewGuard(page);
    await guard.mock('**/api/curriculum', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"mocked":true}' })
    );
    const response = await page.goto(PROD_ENDPOINT);
    expect(response && response.status()).toBe(200);
    expect(await response.text()).toContain('mocked');
    expect(guard.blockedDestinations).toEqual([]);
  });

  test('aborts the production request once the mock is removed', async ({ page }) => {
    const guard = await installLocalPreviewGuard(page);
    await guard.mock('**/api/curriculum', (route) => route.fulfill({ status: 200, body: '{}' }));
    await page.unroute('**/api/curriculum');
    const outcome = await navigationOutcome(page, PROD_ENDPOINT);
    expect(outcome.navigated, 'unmocked production request must be blocked').toBe(false);
    expect(guard.blockedDestinations).toContain(PROD_ENDPOINT);
  });

  test('preserves static-catalog fallback when the endpoint returns 503', async ({ page }) => {
    const guard = await installLocalPreviewGuard(page);
    await guard.mock('**/api/curriculum', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
    await page.goto(LOCAL + '/catalog/');
    await expect(page.locator('html')).toHaveAttribute('data-catalog-source', 'static');
    await expect(page.locator('.catalog-course-card')).toHaveCount(68);
  });

  test('blocks unauthorized loopback ports, including 3003', async ({ context }) => {
    const other = await probeBlockedNavigation(context, 'http://127.0.0.1:3999/');
    expect(other.outcome.navigated, 'unapproved loopback port must be blocked').toBe(false);
    expect(other.guard.blockedDestinations).toContain('http://127.0.0.1:3999/');

    const previewRoot = await probeBlockedNavigation(context, 'http://127.0.0.1:3003/');
    expect(previewRoot.outcome.navigated, 'port 3003 is not approved by default').toBe(false);
    expect(previewRoot.guard.blockedDestinations).toContain('http://127.0.0.1:3003/');
  });

  test('an unexpected external hostname cannot bypass the guard', async ({ context }) => {
    const external = await probeBlockedNavigation(context, 'https://example.com/');
    expect(external.outcome.navigated).toBe(false);
    expect(external.guard.blockedDestinations).toContain('https://example.com/');

    const lookalike = await probeBlockedNavigation(context, 'https://app.autolearnpro.com.evil.test/');
    expect(lookalike.outcome.navigated).toBe(false);
    expect(lookalike.guard.blockedDestinations).toContain('https://app.autolearnpro.com.evil.test/');
  });

  test('does not leak credentials, query strings or fragments in blocked logs', async ({ page }) => {
    // Direct unit assertion of the sanitizer.
    expect(sanitizeUrl(new URL('https://user:pass@app.autolearnpro.com/api/x?token=secret#frag')))
      .toBe('https://app.autolearnpro.com/api/x');

    // And end-to-end through the guard.
    const guard = await installLocalPreviewGuard(page);
    const outcome = await navigationOutcome(page, 'https://example.com/path?token=secret123#frag');
    expect(outcome.navigated).toBe(false);
    const logged = JSON.stringify(guard.blockedDestinations);
    expect(logged).toContain('https://example.com/path');
    expect(logged).not.toContain('secret123');
    expect(logged).not.toContain('?token');
  });

  test('masks identifier-like path segments while preserving route shape', () => {
    expect(
      sanitizeUrl(new URL('https://h.test/api/assessment-attempts/11111111-1111-4111-8111-111111111111/questions'))
    ).toBe('https://h.test/api/assessment-attempts/:id/questions');
    expect(sanitizeUrl(new URL('https://h.test/users/73junito@gmail.test/profile'))).toBe(
      'https://h.test/users/:redacted/profile'
    );
    expect(sanitizeUrl(new URL('https://h.test/token/abcdefghijklmnopqrstuvwxyz012345/done'))).toBe(
      'https://h.test/token/:id/done'
    );
    // Short literal segments stay readable for diagnostics.
    expect(sanitizeUrl(new URL('https://h.test/api/curriculum'))).toBe('https://h.test/api/curriculum');
    expect(sanitizeUrl(new URL('https://h.test/'))).toBe('https://h.test/');
  });

  test('malformed approved origins do not echo the submitted value', async ({ page }) => {
    // Genuinely unparseable (empty host) yet carrying both a password-shaped value
    // and a token-shaped query parameter.
    const leaky = 'https://user:sup3rsecret@?token=abc123';
    const message = await installLocalPreviewGuard(page, { approvedOrigins: [leaky] })
      .then(() => null)
      .catch((err) => err.message);
    expect(message).toMatch(/malformed/);
    expect(message).not.toContain('sup3rsecret');
    expect(message).not.toContain('abc123');
    expect(message).not.toContain(leaky);
  });

  test('blockMutations aborts an unmocked same-origin POST and records it', async ({ page }) => {
    const guard = await installLocalPreviewGuard(page, { approvedOrigins: [LOCAL], blockMutations: true });
    await page.goto(LOCAL + '/', { waitUntil: 'domcontentloaded' });

    const outcome = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/scenario-submissions/grade', { method: 'POST', body: '{}' });
        return { escaped: true, status: response.status };
      } catch (err) {
        return { escaped: false };
      }
    });

    expect(outcome.escaped, 'same-origin POST must be aborted').toBe(false);
    expect(guard.blockedMutations).toHaveLength(1);
    expect(guard.blockedMutations[0]).toBe('POST http://127.0.0.1:3012/api/scenario-submissions/grade');

    // GETs on the same approved origin are unaffected.
    const getResponse = await page.goto(LOCAL + '/');
    expect(getResponse && getResponse.status()).toBe(200);
  });

  test('blockMutations is opt-in: mocked writes still work when it is off', async ({ page }) => {
    const guard = await installLocalPreviewGuard(page);
    expect(guard.blockedMutations).toEqual([]);

    await guard.mock('**/api/mock-write', (route) => route.fulfill({ status: 202, body: 'accepted' }));
    await page.goto(LOCAL + '/', { waitUntil: 'domcontentloaded' });
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/mock-write', { method: 'POST', body: '{}' });
      return response.status;
    });

    expect(status).toBe(202);
    expect(guard.blockedMutations).toEqual([]);
  });

  test('rejects malformed or non-loopback approved origins', async ({ page }) => {
    await expect(installLocalPreviewGuard(page, { approvedOrigins: ['not a url'] })).rejects.toThrow(/malformed/);
    await expect(installLocalPreviewGuard(page, { approvedOrigins: ['https://app.autolearnpro.com'] })).rejects.toThrow(/loopback/);
    await expect(installLocalPreviewGuard(page, { approvedOrigins: ['ftp://127.0.0.1'] })).rejects.toThrow(/http\(s\)/);
  });
});
