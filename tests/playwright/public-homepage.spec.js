const { test, expect } = require('@playwright/test');

test.describe('Public homepage', () => {
  test('public homepage launches the AutoLearnPro platform', async ({ page }) => {
    const base = process.env.PUBLIC_SITE_BASE_URL || '/';

    const consoleErrors = [];
    const failedRequests = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('response', resp => { if (!resp.ok()) failedRequests.push({ url: resp.url(), status: resp.status() }); });

    await page.goto(base, { waitUntil: 'networkidle' });

    await expect(page).toHaveTitle(/AutoLearnPro|Automotive Diagnostic Training/i);

    await expect(
      page.getByRole('heading', { name: /Master Automotive Diagnostics/i })
    ).toBeVisible();

    // Verify both CTAs point to the platform (hero and nav)
    await expect(
      page.getByRole('link', { name: 'Launch AutoLearnPro' })
    ).toHaveAttribute('href', 'https://app.autolearnpro.com/');

    await expect(
      page.getByRole('link', { name: 'Launch Platform' })
    ).toHaveAttribute('href', 'https://app.autolearnpro.com/');

    // basic checks
    const content = await page.content();
    expect(content).not.toContain('vercel.app');

    // viewport mobile check + screenshot
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'playwright/screenshots/public-homepage-mobile.png', fullPage: true });

    // ensure no console errors or failed requests
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
