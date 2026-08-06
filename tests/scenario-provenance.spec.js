/** @jest-environment node */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

describe('scenario question provenance', () => {
  let sandbox;

  beforeAll(() => {
    const file = path.resolve(process.cwd(), 'data', 'scenario-questions.js');
    const src = fs.readFileSync(file, 'utf8');
    sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
  });

  test('approved questions reference approved sources', () => {
    const banks = sandbox.window && sandbox.window.SCENARIO_QUESTIONS ? sandbox.window.SCENARIO_QUESTIONS : {};
    const approvedSources = sandbox.window && sandbox.window.APPROVED_SOURCES ? sandbox.window.APPROVED_SOURCES : {};

    for (const [scenarioId, questions] of Object.entries(banks)) {
      for (const question of questions) {
        if (String(question.status || '').toLowerCase() === 'approved') {
          const id = question.id || question.__qid || '<unknown>';
          expect(Array.isArray(question.sources)).toBe(true);
          expect(question.sources.length).toBeGreaterThan(0);
          expect(question.correct_answer).toBeTruthy();
          expect(question.explanation).toBeTruthy();

          for (const source of question.sources) {
            expect(source.source_id).toBeTruthy();
            const resolved = approvedSources[source.source_id];
            expect(resolved).toBeDefined();
            expect(resolved.status === 'approved' || resolved.approved === true).toBeTruthy();
            expect(source.title || source.section || source.locator).toBeTruthy();
          }
        }
      }
    }
  });
});
