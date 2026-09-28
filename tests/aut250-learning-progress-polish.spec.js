const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

describe('AUT-250 learner progress and polish', () => {
  const course = read('exam-site/courses/aut-250/course.js');
  const moduleSource = read('exam-site/courses/aut-250/module/module.js');
  const courseHtml = read('exam-site/courses/aut-250/index.html');
  const moduleHtml = read('exam-site/courses/aut-250/module/index.html');
  const visuals = read('exam-site/courses/aut-250/module/module-visuals.js');
  const styles = read('exam-site/styles.css');
  const approval = json('data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json');

  test('completion requires participation in every module question, not a manual toggle', () => {
    expect(course).toContain('PROGRESS_VERSION = 2');
    expect(moduleSource).toContain('attemptedQuestionIds');
    expect(moduleSource).toContain('feedbackViewedQuestionIds');
    expect(moduleSource).toContain('questionIds.every((id) => next.attemptedQuestionIds.includes(id))');
    expect(moduleSource).toContain('questionIds.every((id) => next.feedbackViewedQuestionIds.includes(id))');
    expect(course).not.toContain('data-toggle-module');
    expect(course).not.toContain('Mark complete');
  });

  test('persists current question and resumes the learner at question-level state', () => {
    expect(moduleSource).toContain('currentQuestionIndex');
    expect(moduleSource).toContain('requestedQuestionIndex');
    expect(moduleSource).toContain('lastModuleId');
    expect(course).toContain('&question=');
    expect(course).toContain('Continue Module');
  });

  test('structured feedback separates result, why, and diagnostic takeaway', () => {
    expect(moduleSource).toContain('<span>Result</span>');
    expect(moduleSource).toContain('<span>Why</span>');
    expect(moduleSource).toContain('<span>Diagnostic takeaway</span>');
    expect(moduleSource).toContain('REASONING_TAKEAWAYS');
    expect(moduleSource).toContain('This does not authorize a vehicle service action');
    expect(moduleHtml).toContain('data-retry-answer hidden');
    expect(moduleHtml).toContain('data-submit-answer disabled');
  });

  test('highlights the active project-authored reasoning step without changing scoring', () => {
    for (const step of ['request', 'measure', 'compare', 'correlate', 'verify']) {
      expect(moduleHtml).toContain(`data-reasoning-step="${step}"`);
    }
    expect(moduleSource).toContain('setActiveReasoningStep');
    expect(moduleSource).toContain('aria-current');
    expect(approval.approval_effect_if_confirmed.scored).toBe(false);
    expect(approval.approval_effect_if_confirmed.high_stakes_eligible).toBe(false);
    expect(approval.approval_effect_if_confirmed.institutional_assessment_eligible).toBe(false);
    expect(approval.approval_effect_if_confirmed.production_assessment_api_eligible).toBe(false);
  });

  test('dashboard reports learning activity without calculating a grade', () => {
    expect(courseHtml).toContain('data-progress-attempted');
    expect(courseHtml).toContain('data-progress-activity');
    expect(courseHtml).toContain('data-progress-hours');
    expect(courseHtml).toContain('data-progress-lessons');
    expect(course).toContain('24 training hours · 6 modules · 18 lessons · 20 formative questions');
    expect(course).toContain('activityPercent');
    expect(course).not.toMatch(/grade|scorePercent|percentCorrect/i);
  });

  test('module introduces learning focus before visuals and visuals include takeaways', () => {
    const summaryIndex = moduleHtml.indexOf('data-learning-summary');
    const visualsIndex = moduleHtml.indexOf('data-visual-section');
    expect(summaryIndex).toBeGreaterThan(0);
    expect(visualsIndex).toBeGreaterThan(summaryIndex);
    expect(moduleSource).toContain('data-learning-objectives');
    expect(visuals).toContain('const TAKEAWAYS = {');
    expect(visuals).toContain('module-visual-takeaway');
    expect(visuals).toContain('<strong>Takeaway:</strong>');
  });

  test('adds keyboard focus, mobile hierarchy, and print-specific behavior', () => {
    expect(moduleHtml).toContain('data-question-card tabindex="-1"');
    expect(moduleHtml).toContain('role="status" aria-live="polite"');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('@media print');
    expect(styles).toContain('.aut250-progress-metrics');
    expect(styles).toContain('.aut250-module-status');
    expect(styles).not.toContain('/* AUT-250 instructor / evidence drawer */');
  });
});
