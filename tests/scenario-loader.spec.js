/**
 * @file scenario-loader.spec.js
 * @description Unit tests for js/scenario-loader.js
 * Spec: docs/hero-cta.md §3a, §4 | Issue: HERO-003
 */

import { loadDemoScenario, resetConfigCache } from '../js/scenario-loader.js';

const MOCK_CONFIG = {
  'demo-default': {
    id: 'demo-default', headline: 'Diagnose Any Car Problem in Minutes',
    subheadline: 'Step-by-step AI-guided diagnostics.', ctaLabel: 'Start Free Demo',
    imageUrl: '/assets/images/hero-default.webp',
    assetUrls: ['/assets/data/scenarios/demo-default.json'],
    meta: { description: 'Default', audience: 'general', addedIn: '1.0.0' },
  },
  startup: {
    id: 'startup', headline: 'Ship Fleet Diagnostics Faster',
    subheadline: 'Built for lean teams.', ctaLabel: 'See the Startup Demo',
    imageUrl: '/assets/images/hero-startup.webp',
    assetUrls: ['/assets/data/scenarios/startup.json'],
    meta: { description: 'Startup', audience: 'startup', addedIn: '1.0.0' },
  },
};

function mockFetchSuccess(override = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, json: () => Promise.resolve({ ...MOCK_CONFIG, ...override }),
  });
}
function mockFetchFailure(status = 500) {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status, statusText: 'Internal Server Error' });
}
function stubPrefetchLinks() {
  jest.spyOn(document.head, 'appendChild').mockImplementation((el) => {
    if (el.tagName === 'LINK' && el.rel === 'prefetch') el.dispatchEvent(new Event('load'));
    return el;
  });
}

beforeEach(() => { jest.useFakeTimers(); resetConfigCache(); stubPrefetchLinks(); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); jest.resetModules(); });

describe('loadDemoScenario', () => {

  describe('happy path', () => {
    it('resolves with { id, config } for a known scenario id', async () => {
      mockFetchSuccess();
      const result = await loadDemoScenario('demo-default');
      expect(result).toEqual({ id: 'demo-default', config: MOCK_CONFIG['demo-default'] });
    });

    it('fetches hero-scenarios.json exactly once across multiple calls', async () => {
      mockFetchSuccess();
      await loadDemoScenario('demo-default');
      await loadDemoScenario('startup');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/hero-scenarios.json');
    });

    it('resolves with correct config for the "startup" scenario', async () => {
      mockFetchSuccess();
      const { id, config } = await loadDemoScenario('startup');
      expect(id).toBe('startup');
      expect(config.ctaLabel).toBe('See the Startup Demo');
    });
  });

  describe('unknown-id fallback', () => {
    it('falls back to "demo-default" when requested id is missing', async () => {
      mockFetchSuccess();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { config } = await loadDemoScenario('nonexistent');
      expect(config).toEqual(MOCK_CONFIG['demo-default']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"nonexistent" not found'));
    });

    it('throws if "demo-default" is also missing from config', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true, json: () => Promise.resolve({ startup: MOCK_CONFIG.startup }),
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(loadDemoScenario('nonexistent')).rejects.toThrow('"demo-default" missing');
    });
  });

  describe('config fetch failure', () => {
    it('rejects when hero-scenarios.json returns non-ok status', async () => {
      mockFetchFailure(503);
      await expect(loadDemoScenario('demo-default')).rejects.toThrow('Config fetch failed: 503');
    });

    it('rejects when fetch itself throws a network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network unreachable'));
      await expect(loadDemoScenario('demo-default')).rejects.toThrow('Network unreachable');
    });
  });

  describe('timeout — 10 s (docs/hero-cta.md §4)', () => {
    it('rejects after 10 000 ms if config fetch never resolves', async () => {
      global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
      const promise = loadDemoScenario('demo-default');
      jest.advanceTimersByTime(10_001);
      await expect(promise).rejects.toThrow(/timed out after 10000ms/i);
    });

    it('resolves when fetch completes well before the threshold', async () => {
      mockFetchSuccess();
      const promise = loadDemoScenario('demo-default');
      jest.advanceTimersByTime(5_000);
      await expect(promise).resolves.toMatchObject({ id: 'demo-default' });
    });
  });

  describe('asset prefetch', () => {
    it('injects <link rel="prefetch"> for each declared assetUrl', async () => {
      mockFetchSuccess();
      await loadDemoScenario('demo-default');
      const hrefs = document.head.appendChild.mock.calls
        .map(([el]) => el).filter((el) => el.rel === 'prefetch').map((el) => el.href);
      expect(hrefs).toContain('http://localhost/assets/data/scenarios/demo-default.json');
    });

    it('resolves even if a single asset prefetch fails (non-fatal)', async () => {
      mockFetchSuccess();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      let callCount = 0;
      jest.spyOn(document.head, 'appendChild').mockImplementation((el) => {
        if (el.tagName === 'LINK' && el.rel === 'prefetch') {
          callCount++;
          el.dispatchEvent(new Event(callCount === 1 ? 'error' : 'load'));
        }
        return el;
      });
      await expect(loadDemoScenario('demo-default')).resolves.toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Prefetch failed'), expect.any(Error));
    });
  });

  describe('config caching', () => {
    it('does not re-fetch on subsequent calls', async () => {
      mockFetchSuccess();
      await loadDemoScenario('demo-default');
      await loadDemoScenario('startup');
      await loadDemoScenario('demo-default');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

});
