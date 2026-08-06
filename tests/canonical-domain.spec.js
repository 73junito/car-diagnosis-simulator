const fs = require('node:fs');
const path = require('node:path');

const OLD_DOMAIN = 'car-diagnosis-simulator.vercel.app';
const CANONICAL_DOMAIN = 'https://app.autolearnpro.com';

describe('canonical production domain', () => {
  test.each([
    'config/app.config.js',
    'sitemap.xml',
    'robots.txt',
    'validate_playwright.js',
    'scripts/ui-audit/capture-pages.js'
  ])('%s does not reference the retired Vercel domain', (file) => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '..', file),
      'utf8'
    );

    expect(content).not.toContain(OLD_DOMAIN);
  });

  test('sitemap uses the canonical production domain', () => {
    const sitemap = fs.readFileSync(
      path.resolve(__dirname, '..', 'sitemap.xml'),
      'utf8'
    );

    expect(sitemap).toContain(CANONICAL_DOMAIN);
  });

  test('robots points to the canonical sitemap', () => {
    const robots = fs.readFileSync(
      path.resolve(__dirname, '..', 'robots.txt'),
      'utf8'
    );

    expect(robots).toContain(
      'Sitemap: https://app.autolearnpro.com/sitemap.xml'
    );
  });
});
