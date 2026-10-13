const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3003' });

test('instructor research uses canonical Phase 8A rendering without root theme.css', async ({ page }) => {
  await page.route('**/auth.js', (route) => route.abort());
  await page.route('**/dashboard/instructor/research/research.js', (route) => route.abort());
  await page.goto('/dashboard/instructor/research/index.html', { waitUntil: 'domcontentloaded' });

  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('href'))
  );
  expect(stylesheets).not.toContain('/theme.css');
  expect(stylesheets).toContain('/theme/tokens.css');
  expect(stylesheets).toContain('/theme/layout.css');
  expect(stylesheets).toContain('/theme/dashboard.css');
  expect(stylesheets).toContain('./research.css');

  const body = await page.locator('body').evaluate((el) => {
    const s = getComputedStyle(el);
    return { backgroundColor: s.backgroundColor, color: s.color, padding: s.padding };
  });
  expect(body.backgroundColor).toBe('rgb(244, 247, 251)');
  expect(body.color).toBe('rgb(16, 32, 51)');
  expect(body.padding).toBe('0px');

  const input = page.locator('#research-query');
  const inputStyles = await input.evaluate((el) => {
    const s = getComputedStyle(el);
    return { backgroundColor: s.backgroundColor, borderStyle: s.borderStyle, width: s.width };
  });
  expect(inputStyles.backgroundColor).toBe('rgb(255, 255, 255)');
  expect(inputStyles.borderStyle).toBe('solid');
  expect(Number.parseFloat(inputStyles.width)).toBeGreaterThan(200);
});
