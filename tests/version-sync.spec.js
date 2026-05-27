/* eslint-env jest */
const path = require('path');

describe('dashboard/version-sync', () => {
  beforeEach(() => {
    // reset DOM
    document.body.textContent = '';
    delete window.APP_VERSION;
    jest.resetModules();
  });

  test('checkVersion sets window.APP_VERSION when version.json returned', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: '2026.05.26.1' }),
      headers: { get: () => null }
    });

    const vs = require(path.join('..', 'dashboard', 'version-sync.js'));
    const v = await vs.checkVersion();
    expect(v).toBe('2026.05.26.1');
    expect(window.APP_VERSION).toBe('2026.05.26.1');
  });

  test('shows reload banner when deployed version changes', async () => {
    window.APP_VERSION = 'old-version';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: 'new-version' }),
      headers: { get: () => null }
    });

    const vs = require(path.join('..', 'dashboard', 'version-sync.js'));
    await vs.checkVersion();
    const banner = document.getElementById('version-sync-banner');
    expect(banner).not.toBeNull();
    // cleanup
    if (banner) banner.remove();
  });
});
