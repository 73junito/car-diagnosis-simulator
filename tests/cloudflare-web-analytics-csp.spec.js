const fs = require('fs');
const path = require('path');

describe('Cloudflare Web Analytics CSP contract', () => {
  const headers = fs.readFileSync(path.join(__dirname, '..', '_headers'), 'utf8');

  test('allows only the Cloudflare Insights script origin required by the beacon', () => {
    const cspLine = headers.split(/\r?\n/).find((line) =>
      line.trim().startsWith('Content-Security-Policy:')
    );

    expect(cspLine).toBeTruthy();
    expect(cspLine).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;");
    expect(cspLine).not.toContain("'unsafe-eval'");
    expect(cspLine).toContain("connect-src 'self' https://pffdgqpynpbffbcnxmum.supabase.co;");
  });
});
