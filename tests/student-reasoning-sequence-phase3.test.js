/** @jest-environment node */
const fs = require('fs');
const path = require('path');

const scenarioJs = fs.readFileSync(path.resolve('dashboard/student/scenario/scenario.js'), 'utf8');
const scenarioCss = fs.readFileSync(path.resolve('dashboard/student/scenario/scenario.css'), 'utf8');
const audit = fs.readFileSync(path.resolve('docs/redesign-architecture-audit.md'), 'utf8');

describe('Phase 3 student reasoning sequence', () => {
  test('presents the five-stage diagnostic reasoning model in the scenario UI', () => {
    expect(scenarioJs).toContain('Concern &rarr; Evidence &rarr; Evaluate &rarr; Test &rarr; Verify');
    for (const step of ['concern', 'evidence', 'evaluate', 'test', 'verify']) {
      expect(scenarioJs).toContain('data-reasoning-step="' + step + '"');
    }
    expect((scenarioJs.match(/renderReasoningSequence\(isAssessmentMode\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  test('keeps assessment and training semantics explicit', () => {
    expect(scenarioJs).toContain("const modeLabel = isAssessmentMode ? 'Assessment' : 'Training'");
    expect(scenarioJs).toContain('preserving its existing feedback and grading rules');
    expect(scenarioJs).toContain('delivery_mode: isAssessmentMode');
    expect(scenarioJs).toContain('Assessment mode: never show correctness');
    expect(scenarioJs).toContain('Training mode: show correctness and explanations');
  });

  test('keeps existing behavioral selectors and server grading endpoint intact', () => {
    expect(scenarioJs).toContain('class="question-card"');
    expect(scenarioJs).toContain('class="submit-answer"');
    expect(scenarioJs).toContain("fetch('/api/scenario-submissions/grade'");
    expect(scenarioJs).toContain('attempt_id: attemptId');
    expect(scenarioJs).toContain('question_id: questionId');
  });

  test('adds responsive non-color-only step presentation', () => {
    expect(scenarioCss).toContain('.reasoning-sequence {');
    expect(scenarioCss).toContain('.reasoning-steps');
    expect(scenarioCss).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
    expect(scenarioCss).toContain('@media (max-width: 560px)');
    expect(scenarioJs).toContain('<strong>Concern</strong>');
    expect(scenarioJs).toContain('<strong>Verify</strong>');
  });

  test('roadmap records completed Phase 1 and Phase 3 work', () => {
    expect(audit).toContain('[x] **Token consolidation PR** (Phase 1)');
    expect(audit).toContain('[x] **Student reasoning-sequence refactor** (Phase 3)');
  });
});
