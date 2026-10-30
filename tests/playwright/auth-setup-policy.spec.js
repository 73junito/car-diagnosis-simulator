const { test, expect } = require('@playwright/test');
const { resolveRemoteAuthTarget } = require('./auth-setup-policy');

// These tests exercise the pure policy module only: no browser, no navigation,
// no network, no credentials. The production host is referenced as a *string*
// and is never contacted.

test.describe('playwright remote auth opt-in policy', () => {
  test('blocks when no opt-in variable is present', () => {
    const result = resolveRemoteAuthTarget({});
    expect(result.allowed).toBe(false);
    expect(result.url).toBeNull();
  });

  test('blocks when opt-in is set but no target URL is provided', () => {
    const result = resolveRemoteAuthTarget({ PLAYWRIGHT_REMOTE_AUTH: 'true' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/PLAYWRIGHT_REMOTE_AUTH_URL is required/);
  });

  test('blocks when a target URL is provided without opt-in', () => {
    const result = resolveRemoteAuthTarget({ PLAYWRIGHT_REMOTE_AUTH_URL: 'https://app.autolearnpro.com/' });
    expect(result.allowed).toBe(false);
    expect(result.url).toBeNull();
  });

  test('blocks malformed target URLs', () => {
    for (const bad of ['not-a-url', '://missing-protocol', 'https://', '   ']) {
      const result = resolveRemoteAuthTarget({ PLAYWRIGHT_REMOTE_AUTH: 'true', PLAYWRIGHT_REMOTE_AUTH_URL: bad });
      expect(result.allowed, `expected block for ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  test('blocks unauthorized hosts and non-https schemes', () => {
    const cases = [
      'https://evil.example.com/',
      'https://app.autolearnpro.com.evil.test/',
      'https://autolearnpro.com.evil.test/',
      'http://app.autolearnpro.com/',
      'https://127.0.0.1:3012/',
    ];
    for (const target of cases) {
      const result = resolveRemoteAuthTarget({ PLAYWRIGHT_REMOTE_AUTH: 'true', PLAYWRIGHT_REMOTE_AUTH_URL: target });
      expect(result.allowed, `expected block for ${target}`).toBe(false);
    }
  });

  test('never echoes the submitted value in a failure reason', () => {
    const malformed = resolveRemoteAuthTarget({ PLAYWRIGHT_REMOTE_AUTH: 'true', PLAYWRIGHT_REMOTE_AUTH_URL: 'ht!tp://bad value' });
    expect(malformed.allowed).toBe(false);
    expect(malformed.reason).not.toContain('ht!tp');
    expect(malformed.reason).not.toContain('bad value');

    const leaky = 'https://user:sup3rsecret@app.autolearnpro.com/?token=abc123';
    const withCreds = resolveRemoteAuthTarget({ PLAYWRIGHT_REMOTE_AUTH: 'true', PLAYWRIGHT_REMOTE_AUTH_URL: leaky });
    expect(withCreds.allowed).toBe(false);
    expect(withCreds.reason).not.toContain('sup3rsecret');
    expect(withCreds.reason).not.toContain('abc123');
    expect(withCreds.reason).not.toContain(leaky);
  });

  test('blocks URLs containing embedded credentials', () => {
    const cases = [
      'https://user:secret@app.autolearnpro.com/',
      'https://user@app.autolearnpro.com/',
      'https://:secret@app.autolearnpro.com/',
    ];
    for (const target of cases) {
      const result = resolveRemoteAuthTarget({ PLAYWRIGHT_REMOTE_AUTH: 'true', PLAYWRIGHT_REMOTE_AUTH_URL: target });
      expect(result.allowed, `expected block for ${target}`).toBe(false);
      expect(result.reason).toMatch(/embedded credentials/);
      expect(result.url).toBeNull();
    }
  });

  test('accepts an authorized https target without contacting it', () => {
    const result = resolveRemoteAuthTarget({
      PLAYWRIGHT_REMOTE_AUTH: 'true',
      PLAYWRIGHT_REMOTE_AUTH_URL: 'https://app.autolearnpro.com/',
    });
    expect(result.allowed).toBe(true);
    expect(result.url).toBe('https://app.autolearnpro.com/');
  });

  test('CI=true alone does not authorize remote authentication', () => {
    const result = resolveRemoteAuthTarget({ CI: 'true' });
    expect(result.allowed).toBe(false);
    expect(result.url).toBeNull();
  });
});
