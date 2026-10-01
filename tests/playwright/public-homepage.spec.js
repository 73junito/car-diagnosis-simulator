const { test, expect } = require('@playwright/test');

test.describe('Public homepage', () => {
  test('public homepage exposes current student and instructor entry points', async ({ page }) => {
    const base = process.env.PUBLIC_SITE_BASE_URL || '/';

    const consoleErrors = [];
    const failedRequests = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('response', resp => { if (!resp.ok()) failedRequests.push({ url: resp.url(), status: resp.status() }); });

    await page.goto(base, { waitUntil: 'networkidle' });

    await expect(page).toHaveTitle('AutoLearnPro | Evidence-Governed Automotive Learning');

    await expect(
      page.getByRole('heading', { name: /Build Automotive Diagnostic Reasoning/i })
    ).toBeVisible();

    await expect(
      page.getByRole('link', { name: 'Student Sign In' }).first()
    ).toHaveAttribute('href', 'https://app.autolearnpro.com/sign-in/student/');

    await expect(
      page.getByRole('link', { name: 'Instructor Sign In' }).first()
    ).toHaveAttribute('href', 'https://app.autolearnpro.com/sign-in/instructor/');

    await expect(
      page.getByRole('link', { name: 'Explore Curriculum' })
    ).toHaveAttribute('href', 'https://exam.autolearnpro.com/learning-path/');

    const content = await page.content();
    expect(content).not.toContain('20-question attempts');
    expect(content).not.toContain('refreshed question sets after repeated failures');
    expect(content).not.toContain('vercel.app');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'playwright/screenshots/public-homepage-mobile.png', fullPage: true });

    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
