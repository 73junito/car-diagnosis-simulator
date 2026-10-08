const fs = require('fs');
const path = require('path');

describe('Cloudflare Web Analytics CSP contract', () => {
  const assetHeaderPaths = [
    path.join(__dirname, '..', '_headers'),
    path.join(__dirname, '..', 'public-site', '_headers'),
    path.join(__dirname, '..', 'exam-site', '_headers'),
  ];
  const headerFiles = assetHeaderPaths.map((filePath) => fs.readFileSync(filePath, 'utf8'));
  const headers = headerFiles[0];

  test('allows only the Cloudflare Insights script origin required by the beacon', () => {
    const cspLine = headers.split(/\r?\n/).find((line) =>
      line.trim().startsWith('Content-Security-Policy:')
    );

    expect(cspLine).toBeTruthy();
    expect(cspLine).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;");
    expect(cspLine).not.toContain("'unsafe-eval'");
    expect(cspLine).toContain("connect-src 'self' https://pffdgqpynpbffbcnxmum.supabase.co;");
  });

  test('ships identical security headers for app, public, and exam asset roots', () => {
    for (const candidate of headerFiles.slice(1)) {
      expect(candidate).toBe(headers);
    }
  });

  test('keeps HSTS zone-managed instead of duplicating it in asset headers', () => {
    for (const candidate of headerFiles) {
      expect(candidate).not.toMatch(/^\s*Strict-Transport-Security:/mi);
    }
  });
});
