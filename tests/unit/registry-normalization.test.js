/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

function loadScriptIntoWindow(filePath, window) {
  const code = fs.readFileSync(filePath, 'utf8');
   
  const fn = new Function('window','document','self','location','history', code + '\n//# sourceURL=' + filePath);
  fn(window, window.document, window, window.location, window.history);
}

describe('scenario-registry normalization', () => {
  beforeEach(() => {
    // prepare a minimal DOM
    document.documentElement.innerHTML = '<!doctype html><html><head></head><body></body></html>';
    // isolation: additive analysis-contract state must not leak between tests
    delete window.TorqueMindAnalysisLevels;
    delete window.scenarios;
    delete window.SCENARIO_REGISTRY;
  });

  test('registry exposes unique ids and id exists for every entry', () => {
    const scenarios = [
      { id: 101, symptoms: 'Alpha symptoms', symptomCategory: 'dup-cat', difficulty: 4 },
      { id: 102, symptoms: 'Beta symptoms', symptomCategory: 'dup-cat', difficulty: 2 }
    ];
    window.scenarios = scenarios;
    loadScriptIntoWindow(path.resolve(__dirname, '../../data/scenario-registry.js'), window);
    const reg = window.SCENARIO_REGISTRY;
    expect(Array.isArray(reg)).toBe(true);
    expect(reg.length).toBe(2);
    // all ids present
    expect(reg.every(s => s.id)).toBe(true);
    // uniqueness
    const ids = reg.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // since both had same symptomCategory, second should have suffix with numeric id or unique append
    expect(ids[0]).not.toBe(ids[1]);
  });

  test('title fallback uses symptoms when title absent', () => {
    const scenarios = [ { id: 201, symptoms: 'Symptoms fallback test', difficulty: 1 } ];
    window.scenarios = scenarios;
    loadScriptIntoWindow(path.resolve(__dirname, '../../data/scenario-registry.js'), window);
    const reg = window.SCENARIO_REGISTRY;
    expect(reg[0].title).toBe('Symptoms fallback test');
  });

  test('difficulty numeric maps to skill levels', () => {
    const scenarios = [ { id: 301, symptoms: 'Easy', difficulty: 2 }, { id: 302, symptoms: 'Hard', difficulty: 5 } ];
    window.scenarios = scenarios;
    loadScriptIntoWindow(path.resolve(__dirname, '../../data/scenario-registry.js'), window);
    const reg = window.SCENARIO_REGISTRY;
    const byId = {}; reg.forEach(r=>byId[r.numericId]=r);
    expect(byId[301].difficulty.toLowerCase()).toBe('beginner');
    expect(byId[302].difficulty.toLowerCase()).toBe('advanced');
  });

  test('aseArea preserved when provided and defaults to empty string when missing', () => {
    const scenarios = [ { id: 401, symptoms: 'Ase present', aseArea: 'A6' }, { id: 402, symptoms: 'No ase' } ];
    window.scenarios = scenarios;
    loadScriptIntoWindow(path.resolve(__dirname, '../../data/scenario-registry.js'), window);
    const reg = window.SCENARIO_REGISTRY;
    const a401 = reg.find(r=>r.numericId===401);
    const a402 = reg.find(r=>r.numericId===402);
    expect(a401.aseArea).toBe('A6');
    expect(a402.aseArea).toBe('');
  });

  test('additive analysis fields derive from canonical module without touching legacy difficulty', () => {
    loadScriptIntoWindow(path.resolve(__dirname, '../../data/analysis-levels.js'), window);
    window.scenarios = [
      { id: 501, symptoms: 'Mid basic', difficulty: 3 },
      { id: 502, symptoms: 'Deep', difficulty: 5 },
      { id: 503, symptoms: 'Architectural', difficulty: 7 }
    ];
    loadScriptIntoWindow(path.resolve(__dirname, '../../data/scenario-registry.js'), window);
    const byId = {};
    window.SCENARIO_REGISTRY.forEach(r => byId[r.numericId] = r);
    // acceptance contract: analysisLevel passes 1-7 through unchanged
    expect(byId[501].analysisLevel).toBe(3);
    expect(byId[502].analysisLevel).toBe(5);
    expect(byId[503].analysisLevel).toBe(7);
    // single canonical band implementation: 1-3 basic / 4-5 deep / 6-7 architectural-system
    expect(byId[501].analysisBand).toBe('basic');
    expect(byId[502].analysisBand).toBe('deep');
    expect(byId[503].analysisBand).toBe('architectural-system');
    // legacy difficulty semantics preserved exactly alongside the additive fields
    expect(byId[501].difficulty).toBe('intermediate');
    expect(byId[502].difficulty).toBe('advanced');
    expect(byId[503].difficulty).toBe('advanced');
  });

  test('level 6-7 scenarios keep legacy advanced difficulty (regression guard)', () => {
    loadScriptIntoWindow(path.resolve(__dirname, '../../data/analysis-levels.js'), window);
    window.scenarios = [
      { id: 601, symptoms: 'Arch I', difficulty: 6 },
      { id: 602, symptoms: 'Arch II', difficulty: 7 }
    ];
    loadScriptIntoWindow(path.resolve(__dirname, '../../data/scenario-registry.js'), window);
    const byId = {};
    window.SCENARIO_REGISTRY.forEach(r => byId[r.numericId] = r);
    expect(byId[601].difficulty).toBe('advanced');
    expect(byId[602].difficulty).toBe('advanced');
    expect(byId[601].analysisBand).toBe('architectural-system');
    expect(byId[602].analysisBand).toBe('architectural-system');
  });

  test('registry without the canonical module omits additive fields, warns once, and stays legacy-identical', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    window.scenarios = [ { id: 701, symptoms: 'Legacy only', difficulty: 7 } ];
    loadScriptIntoWindow(path.resolve(__dirname, '../../data/scenario-registry.js'), window);
    const entry = window.SCENARIO_REGISTRY[0];
    expect(window.TorqueMindAnalysisLevels).toBeUndefined();
    expect(entry.analysisLevel).toBeUndefined();
    expect(entry.analysisBand).toBeUndefined();
    expect(entry.difficulty).toBe('advanced');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('TorqueMindAnalysisLevels not loaded');
    warn.mockRestore();
  });
});
