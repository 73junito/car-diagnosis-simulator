const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('AUT-250 guided question player', () => {
  const html = read('exam-site/courses/aut-250/module/index.html');
  const js = read('exam-site/courses/aut-250/module/module.js');
  const dashboard = read('exam-site/courses/aut-250/course.js');

  test('uses a dedicated module player route from the dashboard', () => {
    expect(dashboard).toContain('/courses/aut-250/module/?module=');
    expect(html).toContain('data-question-player');
    expect(html).toContain('data-question-position');
  });

  test('renders one question at a time with check, retry, previous, and next controls', () => {
    expect(js).toContain('function renderQuestion(state)');
    expect(js).toContain('function checkAnswer(state)');
    expect(js).toContain('function retryAnswer()');
    expect(html).toContain('data-submit-answer');
    expect(html).toContain('data-retry-answer');
    expect(html).toContain('data-prev-question');
    expect(html).toContain('data-next-question');
  });

  test('enforces training-only question boundaries before rendering', () => {
    expect(js).toContain('question.scored === false');
    expect(js).toContain('question.highStakesEligible === false');
    expect(js).toContain('question.deliveryMode === "training"');
    expect(js).toContain('effect?.production_assessment_api_eligible === false');
  });

  test('feedback explains reasoning without authorizing service action', () => {
    expect(js).toContain('question.explanation');
    expect(js).toContain('This does not authorize a vehicle service action.');
  });

  test('fails closed when approval or module validation fails', () => {
    expect(js).toContain('dataset.aut250PlayerRelease = "blocked"');
    expect(js).toContain('player-gate-blocked');
    expect(js).toContain('data-question-player');
  });
});
