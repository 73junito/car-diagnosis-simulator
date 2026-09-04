const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScenarios() {
  const filePath = path.join(process.cwd(), 'data', 'scenarios.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const window = {};

  vm.runInNewContext(source, { window, console }, { filename: filePath });

  return window.scenarios;
}

describe('Drivetrain scenario catalog', () => {
  const expectedScenarios = [
    {
      id: 18,
      scenario_key: 'automatic-transmission-delayed-drive',
      symptomCategory: 'automatic-transmission',
      symptoms: 'Delayed or harsh shift into Drive'
    },
    {
      id: 19,
      scenario_key: 'manual-transmission-no-drive',
      symptomCategory: 'manual-transmission',
      symptoms: 'Clutch pedal feels normal but vehicle will not move in gear'
    },
    {
      id: 20,
      scenario_key: 'differential-speed-whine',
      symptomCategory: 'differential',
      symptoms: 'Whine or howl that changes with vehicle speed'
    },
    {
      id: 21,
      scenario_key: 'transaxle-fluid-leak-shift-hesitation',
      symptomCategory: 'transaxle',
      symptoms: 'Fluid leak with shift hesitation or gear noise'
    }
  ];

  test('adds four uniquely identifiable drivetrain scenarios', () => {
    const scenarios = loadScenarios();

    for (const expected of expectedScenarios) {
      const scenario = scenarios.find(
        (item) => item.scenario_key === expected.scenario_key
      );

      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(expected.id);
      expect(scenario.symptomCategory).toBe(expected.symptomCategory);
      expect(scenario.symptoms).toContain(expected.symptoms);
    }

    const keys = scenarios.map((item) => item.scenario_key);
    const ids = scenarios.map((item) => item.id);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('provides the required diagnostic contract for each drivetrain scenario', () => {
    const scenarios = loadScenarios();
    const requiredFields = [
      'id',
      'scenario_key',
      'symptoms',
      'difficulty',
      'primarySystem',
      'secondarySystems',
      'symptomCategory',
      'trainingFocus',
      'fault',
      'tests'
    ];

    for (const expected of expectedScenarios) {
      const scenario = scenarios.find(
        (item) => item.scenario_key === expected.scenario_key
      );

      expect(scenario).toBeDefined();

      for (const field of requiredFields) {
        expect(scenario[field]).toBeDefined();
      }

      expect(Array.isArray(scenario.secondarySystems)).toBe(true);
      expect(Object.keys(scenario.tests).length).toBeGreaterThanOrEqual(2);
    }
  });
});
