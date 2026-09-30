const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('Cloudflare-only production runtime contract', () => {
  test('public Worker publishes policy/contact assets with clean URL handling', () => {
    const wrangler = JSON.parse(
      read('wrangler.jsonc').replace(/^\s*\/\/.*$/gm, '')
    );

    expect(wrangler.assets.directory).toBe('./public-site');
    expect(wrangler.assets.html_handling).toBe('auto-trailing-slash');

    for (const file of ['privacy.html', 'terms.html', 'contact.html', 'legal-pages.css']) {
      expect(fs.existsSync(path.join(root, 'public-site', file))).toBe(true);
    }

    const home = read('public-site/index.html');
    expect(home).toContain('href="/privacy"');
    expect(home).toContain('href="/terms"');
    expect(home).toContain('href="/contact"');
  });

  test('active runtime wiring contains no Render or Vercel deployment dependency', () => {
    const files = [
      '_headers',
      'main_index.html',
      'temp_home.html',
      'api/_utils/app-version.js',
      'api/health.js',
      'scripts/write-version.js',
      '.github/workflows/scheduled-harness.yml',
      'package.json',
    ];

    const combined = files.map(read).join('\n');
    expect(combined).not.toMatch(/torquemind-api\.onrender\.com/i);
    expect(combined).not.toMatch(/VERCEL_/);
    expect(combined).not.toMatch(/\bnpx vercel\b/i);

    expect(fs.existsSync(path.join(root, 'render.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'vercel.disabled.json'))).toBe(false);
  });
});
