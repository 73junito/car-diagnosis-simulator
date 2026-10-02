/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

function loadBrowserScript(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const fn = new Function('window', code + '\n//# sourceURL=' + filePath);
  fn(window);
}

describe('Batch 1 no-crank draft bank governance', () => {
  beforeAll(() => {
    window.SCENARIO_QUESTIONS = undefined;
    loadBrowserScript(path.resolve(__dirname, '../data/scenario-questions.js'));
  });

  test('contains exactly 20 uniquely identified draft questions', () => {
    const bank = window.SCENARIO_QUESTIONS['no-crank'];
    expect(Array.isArray(bank)).toBe(true);
    expect(bank).toHaveLength(20);

    const ids = bank.map((question) => question.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(20);

    for (const question of bank) {
      expect(question.status).toBe('draft');
    }
  });

  test('does not silently grant assessment eligibility through static question status', () => {
    const bank = window.SCENARIO_QUESTIONS['no-crank'];
    expect(bank.filter((question) => question.status === 'approved')).toHaveLength(0);
  });

  test('every draft record has the minimum authoring fields', () => {
    const required = [
      'question_text',
      'option_a',
      'option_b',
      'option_c',
      'option_d',
      'correct_answer',
      'explanation',
      'difficulty',
      'topic'
    ];

    for (const question of window.SCENARIO_QUESTIONS['no-crank']) {
      for (const field of required) {
        expect(String(question[field] || '').trim()).not.toBe('');
      }
      expect(['A', 'B', 'C', 'D']).toContain(question.correct_answer);
    }
  });
});
