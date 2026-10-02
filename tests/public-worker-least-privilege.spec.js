/** @jest-environment node */
const fs = require('fs');
const path = require('path');

const publicWorker = require('../worker/public-index.js').default;

/*
 * Least-privilege contract for the public marketing Worker.
 *
 * autolearnpro-public serves the marketing apex (autolearnpro.com). It must
 * not expose the learner/assessment/instructor API surface, which belongs to
 * autolearnpro-app. This test fails if the two entry points are ever merged
 * back into a single full-API script for the public surface.
 */
describe('public Worker least privilege', () => {
  const root = path.resolve(__dirname, '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  const publicConfig = JSON.parse(read('wrangler.jsonc'));
  const appConfig = JSON.parse(read('wrangler.app.jsonc'));

  test('public Worker uses the minimal public entry point', () => {
    expect(publicConfig.main).toBe('worker/public-index.js');
  });

  test('app Worker keeps the full API entry point', () => {
    expect(appConfig.main).toBe('worker/index.js');
  });

  test('public entry point does not import the app API surface', () => {
    const source = read('worker/public-index.js');

    expect(source).not.toMatch(/from\s+['"]\.\/routes\//);
    expect(source).not.toMatch(/from\s+['"]\.\/middleware\//);
    expect(source).not.toMatch(/from\s+['"]\.\/services\//);
  });

  test('public entry point only re-exports the Durable Object the config requires', () => {
    const source = read('worker/public-index.js');
    const durableObjectImports = [
      ...source.matchAll(/from\s+['"](\.\/durable-objects\/[^'"]+)['"]/g)
    ].map((match) => match[1]);

    expect(durableObjectImports).toEqual(['./durable-objects/rate-limit-counter.js']);
  });

  test('public entry point registers only health and ping routes', () => {
    const source = read('worker/public-index.js');
    const registered = [
      ...source.matchAll(/app\.(get|post|put|patch|all|delete)\(\s*['"]([^'"]+)['"]/g)
    ].map((match) => match[2]);

    expect(registered.sort()).toEqual(['/__ping', '/api/health']);
  });

  test('public Worker still publishes the public-site assets', () => {
    expect(publicConfig.assets.directory).toBe('./public-site');
  });

  test('only health and ping bypass asset-first routing', () => {
    expect(publicConfig.assets.run_worker_first).toEqual([
      '/api/health',
      '/__ping'
    ]);
  });

  test('public Worker declares no database or AI bindings', () => {
    expect(publicConfig.secrets_store_secrets).toBeUndefined();
    expect(publicConfig.vars.SUPABASE_URL).toBeUndefined();
  });

  // ── Behavioural checks: routes removed from the public surface must now ──
  // ── return 404 instead of the previous 500 "Server configuration        ──
  // ── incomplete" response.                                              ──

  const call = (url, init) => publicWorker.fetch(new Request(url, init), {}, {});

  test('health endpoint keeps its published response shape', async () => {
    const response = await call('https://autolearnpro.com/api/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      runtime: 'Cloudflare Workers'
    });
  });

  test('ping endpoint responds', async () => {
    const response = await call('https://autolearnpro.com/__ping');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test.each([
    { method: 'GET', route: '/api/curriculum' },
    { method: 'GET', route: '/api/student/progress' },
    { method: 'GET', route: '/api/scenario-questions-approved' },
    { method: 'POST', route: '/api/assessment-attempts/start' },
    { method: 'GET', route: '/api/instructor/verification/status' }
  ])('does not serve the app API route $method $route', async ({ method, route }) => {
    const response = await call(`https://autolearnpro.com${route}`, { method });

    expect(response.status).toBe(404);
  });

  test('does not serve the tutor feedback route', async () => {
    const response = await call('https://autolearnpro.com/api/torquemind-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    expect(response.status).toBe(404);
  });
});
