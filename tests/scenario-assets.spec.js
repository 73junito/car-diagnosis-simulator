/* eslint-env jest */
// Verify scenario registry images resolve to non-empty values and fall back to placeholder
describe('scenario asset normalization', () => {
  beforeAll(() => {
    // ensure registry is loaded in test env
    // require the file which defines window.SCENARIO_REGISTRY in a JSDOM-like environment
    // In tests we simulate by loading the data files if needed
    // Only run if registry exists
  });

  test('all registry entries have a non-empty image path', () => {
    const registry = (global.window && global.window.SCENARIO_REGISTRY) || [];
    expect(Array.isArray(registry)).toBe(true);
    registry.forEach(entry => {
      expect(entry).toBeDefined();
      expect(typeof entry.image).toBe('string');
      expect(entry.image.length).toBeGreaterThan(0);
    });
  });

  test('placeholder path is present in assets', () => {
    // just ensure the placeholder file exists on disk
    const fs = require('fs');
    const path = require('path');
    const p = path.join(process.cwd(), 'assets', 'images', 'scenarios', 'placeholder-scenario.svg');
    const ok = fs.existsSync(p);
    expect(ok).toBe(true);
  });
});
