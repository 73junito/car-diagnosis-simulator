const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3003' });

test('instructor analytics renders canonical Phase 8A presentation without root theme.css', async ({ page }) => {
  await page.route('**/dashboard/instructor/analytics.js', (route) => route.abort());
  await page.goto('/dashboard/instructor/analytics.html', { waitUntil: 'domcontentloaded' });

  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('href'))
  );
  expect(stylesheets).not.toContain('/theme.css');
  expect(stylesheets).toContain('/theme/tokens.css');
  expect(stylesheets).toContain('/theme/layout.css');
  expect(stylesheets).toContain('/theme/dashboard.css');
  expect(stylesheets).toContain('./analytics.css');
  expect(stylesheets).toContain('/theme/legacy-light-bridge.css');

  const body = await page.locator('body').evaluate((el) => {
    const s = getComputedStyle(el);
    return { backgroundColor: s.backgroundColor, color: s.color, padding: s.padding };
  });
  expect(body.backgroundColor).toBe('rgb(244, 247, 251)');
  expect(body.color).toBe('rgb(16, 32, 51)');
  expect(body.padding).toBe('0px');

  const stat = page.locator('#card-total');
  await expect(stat).toHaveCSS('display', 'block');
  await expect(stat.locator('.tm-stat-card__label')).toHaveCSS('text-transform', 'uppercase');
  await expect(stat.locator('.tm-stat-card__value')).toHaveCSS('font-size', '28.8px');

  const button = page.locator('#download-csv');
  await expect(button).toHaveClass(/tm-btn-secondary/);
  await expect(button).toHaveCSS('display', 'flex');

  const gridColumns = await page.locator('#summary-cards').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(gridColumns.split(' ').length).toBeGreaterThanOrEqual(2);
});
