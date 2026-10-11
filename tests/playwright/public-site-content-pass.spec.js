const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3003' });

const routes = [
  '/public-site/about/index.html',
  '/public-site/how-it-works/index.html',
  '/public-site/students/index.html',
  '/public-site/instructors/index.html',
  '/public-site/help/index.html',
];

for (const route of routes) {
  test(`public content route renders: ${route}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('nav[aria-label="Primary navigation"]')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
