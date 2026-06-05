 

const path = require('path');

describe('api-client version mismatch detection', () => {
  let apiClient;

  beforeEach(() => {
    jest.resetModules();
    document.body.textContent = '';
    // ensure localStorage exists
    if (!global.localStorage) {
      const storage = {};
      global.localStorage = {
        getItem: (k) => (k in storage ? storage[k] : null),
        setItem: (k, v) => { storage[k] = v; },
      };
    }
  });

  test('no x-app-version header -> passthrough', async () => {
    const originalFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => null }, text: async () => 'ok' });
    global.fetch = originalFetch;
    apiClient = require(path.join('..', 'dashboard', 'api-client.js'));
    apiClient.initApiClient();

    const r = await window.fetch('/some');
    expect(originalFetch).toHaveBeenCalledTimes(1);
    expect(await r.text()).toBe('ok');
  });

  test('mismatch triggers onStale and retry once', async () => {
    // client version
    window.APP_VERSION = 'v1';

    // first response: server v2 (mismatch)
    // retry response: server v1 (match)
    const first = { ok: true, status: 200, headers: { get: (k) => k === 'x-app-version' ? 'v2' : null }, text: async () => 'first' };
    const second = { ok: true, status: 200, headers: { get: (k) => k === 'x-app-version' ? 'v1' : null }, text: async () => 'second' };
    const originalFetch = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    global.fetch = originalFetch;

    const onStale = jest.fn();
    apiClient = require(path.join('..', 'dashboard', 'api-client.js'));
    apiClient.initApiClient({ onStale, retryOnce: true });

    const r = await window.fetch('/api');
    expect(onStale).toHaveBeenCalled();
    expect(originalFetch).toHaveBeenCalledTimes(2);
    expect(await r.text()).toBe('second');
  });

  test('still stale after retry -> forceReload hint', async () => {
    window.APP_VERSION = 'v1';
    const first = { ok: true, status: 200, headers: { get: (k) => k === 'x-app-version' ? 'v2' : null }, text: async () => 'first' };
    const second = { ok: true, status: 200, headers: { get: (k) => k === 'x-app-version' ? 'v2' : null }, text: async () => 'second' };
    const originalFetch = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    global.fetch = originalFetch;

    const onStale = jest.fn();
    apiClient = require(path.join('..', 'dashboard', 'api-client.js'));
    apiClient.initApiClient({ onStale, retryOnce: true });

    const r = await window.fetch('/api');
    expect(onStale).toHaveBeenCalled();
    // second call should have been invoked and onStale called again with forceReload true
    expect(onStale.mock.calls.some(c => c[1] && c[1].forceReload)).toBe(true);
    expect(await r.text()).toBe('second');
  });
});
