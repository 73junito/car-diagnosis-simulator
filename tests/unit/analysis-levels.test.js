const levels = require('../../data/analysis-levels.js');

describe('seven-level analysis-depth contract', () => {
  test.each([1, 2, 3])('level %i is basic analysis', (level) => {
    expect(levels.bandFor(level)).toBe('basic');
  });

  test.each([4, 5])('level %i is deep analysis', (level) => {
    expect(levels.bandFor(level)).toBe('deep');
  });

  test.each([6, 7])('level %i is architectural/system analysis', (level) => {
    expect(levels.bandFor(level)).toBe('architectural-system');
  });

  test('rejects values outside levels 1-7', () => {
    expect(levels.get(0)).toBeNull();
    expect(levels.get(8)).toBeNull();
    expect(levels.get('not-a-level')).toBeNull();
  });
});
