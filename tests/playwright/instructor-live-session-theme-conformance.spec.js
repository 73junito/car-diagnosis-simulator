const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3003' });

test('instructor live session preserves status semantics on canonical Phase 8A styling', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('supabase_access_token', 'playwright-instructor-token');
  });

  await page.route('**/api/classes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ classes: [{ id: 'class-1', name: 'AUT 250' }] })
    });
  });

  await page.route('**/api/telemetry/stream?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'retry: 3000\n\n'
    });
  });

  await page.goto('/dashboard/instructor/live-session.html', { waitUntil: 'domcontentloaded' });

  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('href'))
  );
  expect(stylesheets).not.toContain('/theme.css');
  expect(stylesheets).toContain('/theme/tokens.css');
  expect(stylesheets).toContain('/theme/layout.css');
  expect(stylesheets).toContain('/theme/dashboard.css');
  expect(stylesheets).toContain('/dashboard/live-session.css');
  expect(stylesheets).toContain('/theme/legacy-light-bridge.css');

  const body = await page.locator('body').evaluate((el) => {
    const s = getComputedStyle(el);
    return { backgroundColor: s.backgroundColor, color: s.color, padding: s.padding };
  });
  expect(body.backgroundColor).toBe('rgb(244, 247, 251)');
  expect(body.color).toBe('rgb(16, 32, 51)');
  expect(body.padding).toBe('0px');

  const status = page.locator('#conn-status');
  await expect(status).toHaveText('Connected');
  await expect(status).toHaveClass(/badge-success/);
  const statusStyle = await status.evaluate((el) => {
    const s = getComputedStyle(el);
    return { backgroundColor: s.backgroundColor, color: s.color };
  });
  expect(statusStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(statusStyle.color).toBe('rgb(255, 255, 255)');

  await expect(page.locator('#event-list')).toHaveCSS('overflow', 'auto');
});
