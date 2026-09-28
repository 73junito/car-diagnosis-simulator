const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('AUT-250 module completion summary', () => {
  const html = read('exam-site/courses/aut-250/module/index.html');
  const js = read('exam-site/courses/aut-250/module/module.js');

  test('shows module and question context together', () => {
    expect(html).toContain('Module 01 · Question 1 of 1');
    expect(js).toContain('Module ${String(state.module.sequence).padStart(2, "0")} · Question ${state.index + 1} of ${state.questions.length}');
  });

  test('completion summary is participation-based and non-scored', () => {
    expect(html).toContain('data-module-completion');
    expect(html).toContain('data-completion-attempted');
    expect(html).toContain('data-completion-feedback');
    expect(html).toContain('Completion reflects participation in formative training');
    expect(js).toContain('attemptedQuestionIds');
    expect(js).toContain('feedbackViewedQuestionIds');
    expect(js).toContain('state.progress.completed === true');
  });

  test('does not falsely complete a module when questions were skipped', () => {
    expect(js).toContain('firstIncomplete');
    expect(js).toContain('Module still in progress');
    expect(js).toContain('Continue incomplete questions');
  });

  test('offers review, next-module, and dashboard navigation after completion', () => {
    expect(html).toContain('data-review-module');
    expect(html).toContain('data-continue-module');
    expect(js).toContain('Continue to Module');
    expect(js).toContain('Return to AUT-250 dashboard');
  });

  test('summarizes reasoning steps practiced without grades', () => {
    expect(js).toContain('uniqueReasoningSteps');
    expect(html).toContain('Reasoning steps practiced');
    expect(js.toLowerCase()).not.toContain('percentcorrect');
    expect(js.toLowerCase()).not.toContain('grade');
  });
});
