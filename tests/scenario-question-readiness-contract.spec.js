const fs = require('fs');
const path = require('path');

describe('scenario question readiness contract', () => {
  const root = path.resolve(__dirname, '..');
  const api = fs.readFileSync(
    path.join(root, 'api', 'scenario-questions-approved.js'),
    'utf8'
  );
  const worker = fs.readFileSync(
    path.join(root, 'worker', 'routes', 'scenario-questions-approved.js'),
    'utf8'
  );
  const scenario = fs.readFileSync(
    path.join(root, 'dashboard', 'student', 'scenario', 'scenario.js'),
    'utf8'
  );

  test('approved endpoints resolve semantic question IDs first', () => {
    for (const source of [api, worker]) {
      expect(source).toContain('question.question_id');
      expect(source).toContain(".in('question_id', provenanceKeys)");
      expect(source).toContain("row.question_id === question.question_id");
    }
  });

  test('worker enforces the same citation-role and chunk approval gates', () => {
    expect(worker).toContain("roles.has('supports-answer')");
    expect(worker).toContain("roles.has('supports-explanation')");
    expect(worker).toContain(".eq('approved', true)");
  });

  test('client recognizes provenance-approved API questions', () => {
    expect(scenario).toContain("q.question_provenance?.status");
  });

  test('empty approved API response falls back only to local draft visibility', () => {
    expect(scenario).toContain('approved.length > 0');
    expect(scenario).toContain('showing local draft records without grading');
    expect(scenario).toContain('window.SCENARIO_QUESTIONS');
  });
});
