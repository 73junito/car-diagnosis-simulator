const fs = require('fs');
const path = require('path');

describe('Cloudflare Web Analytics CSP contract', () => {
  const assetHeaderPaths = [
    path.join(__dirname, '..', '_headers'),
    path.join(__dirname, '..', 'public-site', '_headers'),
    path.join(__dirname, '..', 'exam-site', '_headers'),
  ];
  const headerFiles = assetHeaderPaths.map((filePath) => fs.readFileSync(filePath, 'utf8'));
  const cspLines = headerFiles.map((headers) =>
    headers.split(/\r?\n/).find((line) =>
      line.trim().startsWith('Content-Security-Policy:')
    )
  );

  test('allows only the Cloudflare Insights script origin required by the beacon', () => {
    for (const cspLine of cspLines) {
      expect(cspLine).toBeTruthy();
      expect(cspLine).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;");
      expect(cspLine).not.toContain("'unsafe-eval'");
    }
  });

  test('limits Supabase browser connectivity to the application asset root', () => {
    expect(cspLines[0]).toContain("connect-src 'self' https://pffdgqpynpbffbcnxmum.supabase.co;");
    expect(cspLines[1]).toContain("connect-src 'self';");
    expect(cspLines[2]).toContain("connect-src 'self';");
    expect(cspLines[1]).not.toContain('supabase.co');
    expect(cspLines[2]).not.toContain('supabase.co');
  });

  test('keeps the public and exam security headers aligned', () => {
    expect(headerFiles[2]).toBe(headerFiles[1]);
  });

  test('keeps HSTS zone-managed instead of duplicating it in asset headers', () => {
    for (const candidate of headerFiles) {
      expect(candidate).not.toMatch(/^\s*Strict-Transport-Security:/mi);
    }
  });
});
