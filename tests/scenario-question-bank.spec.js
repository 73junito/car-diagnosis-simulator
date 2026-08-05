/** @jest-environment node */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

describe('scenario question banks', () => {
  test('no-crank has at least 20 unique questions', () => {
    const file = path.resolve(process.cwd(), 'data', 'scenario-questions.js');
    const src = fs.readFileSync(file, 'utf8');

    // Run the file in a VM with a fake window object to capture SCENARIO_QUESTIONS
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);

    const questions = sandbox.window && sandbox.window.SCENARIO_QUESTIONS && sandbox.window.SCENARIO_QUESTIONS['no-crank'];
    expect(Array.isArray(questions)).toBe(true);
    // Ensure at least 20 unique question_text values
    const texts = questions.map((q) => (q && q.question_text) ? String(q.question_text).trim() : '');
    const unique = new Set(texts.filter(Boolean));
    expect(unique.size).toBeGreaterThanOrEqual(20);
  });
});
