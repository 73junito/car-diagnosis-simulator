const fs = require('fs');
const path = require('path');

describe('Cloudflare Worker Preview configuration', () => {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const config = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.app.jsonc'), 'utf8'));

  test('uses a Wrangler version that supports Worker Previews', () => {
    const version = String(pkg.devDependencies.wrangler || '').replace(/^[^0-9]*/, '');
    const [major, minor] = version.split('.').map(Number);
    expect(major > 4 || (major === 4 && minor >= 135)).toBe(true);
  });

  test('keeps production deployment settings intact', () => {
    expect(config.name).toBe('autolearnpro-app');
    expect(config.vars.TORQUEMIND_ENVIRONMENT).toBe('production');
    expect(config.vars.SUPABASE_URL).toBe('https://pffdgqpynpbffbcnxmum.supabase.co');
    expect(config.routes).toEqual([
      expect.objectContaining({
        pattern: 'app.autolearnpro.com',
        custom_domain: true
      })
    ]);
  });

  test('previews are isolated from production data and routes', () => {
    expect(config.previews).toBeDefined();
    expect(config.previews.vars.TORQUEMIND_ENVIRONMENT).toBe('preview');
    expect(config.previews.vars.SUPABASE_URL).toBe('https://jchfruprqpeypdttvlam.supabase.co');
    expect(config.previews.routes).toBeUndefined();
  });

  test('previews declare the Durable Object binding used through env', () => {
    expect(config.previews.durable_objects.bindings).toEqual([
      {
        name: 'TORQUEMIND_RATE_LIMITER',
        class_name: 'TorqueMindRateLimitCounter'
      }
    ]);
  });

  test('package scripts keep production and Preview commands separate', () => {
    expect(pkg.scripts['cloudflare:app:deploy']).toContain('wrangler deploy');
    expect(pkg.scripts['cloudflare:app:preview']).toContain('wrangler preview');
    expect(pkg.scripts['cloudflare:app:preview']).toContain('wrangler.app.jsonc');
  });
});
