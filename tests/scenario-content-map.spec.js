const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRegistry() {
  const root = path.resolve(__dirname, '..');
  const context = { window: {}, console: { warn() {}, log() {}, error() {} } };
  context.window.window = context.window;
  vm.createContext(context);

  for (const file of [
    'data/scenarios.js',
    'data/scenario-content-map.js',
    'data/analysis-levels.js',
    'data/scenario-registry.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context.window.SCENARIO_REGISTRY;
}

describe('scenario content routing', () => {
  const registry = loadRegistry();

  test('all current routed scenarios have explicit independent question banks', () => {
    expect(registry).toHaveLength(21);
    expect(registry.every((item) => item.scenario_key && item.questionBankId && item.route)).toBe(true);
    expect(new Set(registry.map((item) => item.questionBankId)).size).toBe(21);
  });

  test('variant scenarios do not collapse into shared question banks', () => {
    const byKey = Object.fromEntries(registry.map((item) => [item.scenario_key, item]));
    expect(byKey['no-crank-clicking'].questionBankId).toBe('no-crank');
    expect(byKey['no-crank-starter-click'].questionBankId).toBe('no-crank-11');
    expect(byKey['misfire-acceleration'].questionBankId).toBe('misfire');
    expect(byKey['misfire-p0300'].questionBankId).toBe('misfire-9');
    expect(byKey['hybrid-ev-isolation'].questionBankId).toBe('hybrid-ev');
    expect(byKey['hybrid-ev-insulation'].questionBankId).toBe('hybrid-ev-17');
  });
});
