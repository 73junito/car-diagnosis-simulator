/** @jest-environment node */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadBanks() {
  const file = path.resolve(process.cwd(), 'data', 'scenario-questions.js');
  const src = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.SCENARIO_QUESTIONS || {};
}

describe('scenario question bank quality contract', () => {
  const banks = loadBanks();

  test.each([
    ['hybrid-ev', 'hybrid-ev-hv-safety-01'],
    ['hybrid-ev-17', 'hybrid-ev-insulation-fault-01'],
    ['charging-system', 'charging-system-output-check-01']
  ])('%s singleton is explicitly governed as draft authoring content', (bankId, expectedId) => {
    const bank = banks[bankId];
    expect(bank).toHaveLength(1);
    expect(bank[0].id).toBe(expectedId);
    expect(bank[0].status).toBe('draft');
    expect(bank[0].sources).toEqual([]);
  });

  test('no-crank keeps a balanced answer-position distribution without changing approval state', () => {
    const bank = banks['no-crank'];
    expect(bank).toHaveLength(20);

    const counts = bank.reduce((acc, question) => {
      acc[question.correct_answer] = (acc[question.correct_answer] || 0) + 1;
      return acc;
    }, { A: 0, B: 0, C: 0, D: 0 });

    expect(counts).toEqual({ A: 5, B: 5, C: 5, D: 5 });
    expect(bank.every((question) => question.status === 'draft')).toBe(true);
    expect(bank.every((question) => Array.isArray(question.sources) && question.sources.length === 0)).toBe(true);
  });

  test('all static authoring items have unique ids, unique stems, four distinct choices, and valid keys', () => {
    const items = Object.values(banks).flat();
    const ids = items.map((question) => question.id);
    const stems = items.map((question) => String(question.question_text).trim().toLowerCase().replace(/\s+/g, ' '));

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(stems).size).toBe(stems.length);

    for (const question of items) {
      const options = [question.option_a, question.option_b, question.option_c, question.option_d]
        .map((value) => String(value).trim().toLowerCase());
      expect(new Set(options).size).toBe(4);
      expect(['A', 'B', 'C', 'D']).toContain(question.correct_answer);
    }
  });
});
