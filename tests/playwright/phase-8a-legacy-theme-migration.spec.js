const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3003' });

const targets = [
  '/assessment/index.html',
  '/dashboard/live-session.html',
  '/dashboard_live.html',
  '/dashboard_test.html',
  '/main_index.html',
  '/temp_home.html',
];

test.describe('Phase 8A legacy theme migration', () => {
  for (const route of targets) {
    test(route + ' uses canonical light rendering', async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('href'))
      );
      expect(stylesheets.some((href) => /(^|\/)theme\.css$/.test(href || ''))).toBe(false);
      expect(stylesheets.some((href) => (href || '').includes('theme/tokens.css'))).toBe(true);
      expect(stylesheets.some((href) => (href || '').includes('theme/legacy-light-bridge.css'))).toBe(true);

      const body = await page.locator('body').evaluate((el) => {
        const s = getComputedStyle(el);
        return { backgroundColor: s.backgroundColor, color: s.color };
      });
      expect(body.backgroundColor).toBe('rgb(244, 247, 251)');
      expect(body.color).toBe('rgb(16, 32, 51)');
    });
  }

  test('light-surface controls use the AA-safe focus ring', async ({ page }) => {
    await page.goto('/dashboard_live.html', { waitUntil: 'domcontentloaded' });
    const button = page.locator('#download-csv');
    await button.focus();
    await expect(button).toBeFocused();
    const focus = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.outlineColor, width: s.outlineWidth, style: s.outlineStyle };
    });
    expect(focus).toEqual({ color: 'rgb(45, 106, 201)', width: '3px', style: 'solid' });
  });

  test('navy navigation uses the inverse focus ring', async ({ page }) => {
    await page.goto('/main_index.html', { waitUntil: 'domcontentloaded' });
    const link = page.locator('.topnav a[href]').first();
    await link.focus();
    await expect(link).toBeFocused();
    const focus = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.outlineColor, width: s.outlineWidth, style: s.outlineStyle };
    });
    expect(focus).toEqual({ color: 'rgb(147, 197, 253)', width: '3px', style: 'solid' });
  });

  test('live-session status badges preserve semantic text plus color', async ({ page }) => {
    await page.route('**/dashboard/live-session.js', (route) => route.abort());
    await page.goto('/dashboard/live-session.html', { waitUntil: 'domcontentloaded' });
    const status = page.locator('#conn-status');
    await expect(status).toHaveText(/Disconnected|Connected|Error/i);
    const styles = await status.evaluate((el) => {
      const s = getComputedStyle(el);
      return { backgroundColor: s.backgroundColor, color: s.color };
    });
    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.color).toBe('rgb(255, 255, 255)');
  });
});
