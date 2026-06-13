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
});
