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

  test('blocks unmatched production requests', async ({ page }) => {
    const guard = await installLocalPreviewGuard(page);
    const outcome = await navigationOutcome(page, 'https://app.autolearnpro.com/');
    expect(outcome.navigated, 'production navigation must be blocked').toBe(false);
    expect(guard.blockedDestinations).toContain('https://app.autolearnpro.com/');

    // Realistic case: the local catalog page itself requests the production
    // curriculum endpoint, so an unmocked run records the blocked attempt while
    // still rendering from its static fallback.
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

  test('blocks unauthorized loopback ports, including 3003', async ({ page }) => {
    const guard = await installLocalPreviewGuard(page);
    const other = await navigationOutcome(page, 'http://127.0.0.1:3999/');
    expect(other.navigated, 'unapproved loopback port must be blocked').toBe(false);
    expect(guard.blockedDestinations).toContain('http://127.0.0.1:3999/');

    const previewRoot = await navigationOutcome(page, 'http://127.0.0.1:3003/');
    expect(previewRoot.navigated, 'port 3003 is not approved by default').toBe(false);
    expect(guard.blockedDestinations).toContain('http://127.0.0.1:3003/');
  });

  test('an unexpected external hostname cannot bypass the guard', async ({ page }) => {
    const guard = await installLocalPreviewGuard(page);
    const external = await navigationOutcome(page, 'https://example.com/');
    expect(external.navigated).toBe(false);
    expect(guard.blockedDestinations).toContain('https://example.com/');

    const lookalike = await navigationOutcome(page, 'https://app.autolearnpro.com.evil.test/');
    expect(lookalike.navigated).toBe(false);
    expect(guard.blockedDestinations).toContain('https://app.autolearnpro.com.evil.test/');
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

  test('rejects malformed or non-loopback approved origins', async ({ page }) => {
    await expect(installLocalPreviewGuard(page, { approvedOrigins: ['not a url'] })).rejects.toThrow(/malformed/);
    await expect(installLocalPreviewGuard(page, { approvedOrigins: ['https://app.autolearnpro.com'] })).rejects.toThrow(/loopback/);
    await expect(installLocalPreviewGuard(page, { approvedOrigins: ['ftp://127.0.0.1'] })).rejects.toThrow(/http\(s\)/);
  });
});
