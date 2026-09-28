const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

describe('AUT-250 richer feedback and visual priorities', () => {
  const feedback = read('exam-site/courses/aut-250/module/distractor-feedback.js');
  const moduleSource = read('exam-site/courses/aut-250/module/module.js');
  const visuals = read('exam-site/courses/aut-250/module/module-visuals.js');
  const curriculum = json('data/curriculum/lesson-content.json');
  const plan = curriculum.lessonContentPlans.find((item) => item.lessonPlanId === 'ug-hev-foundations');
  const questions = plan.courseModules.flatMap((module) => module.trainingQuestions || []);

  test('covers every approved question with separate post-submission distractor feedback', () => {
    expect(questions).toHaveLength(20);
    for (const question of questions) {
      expect(feedback).toContain(`"${question.id}"`);
    }
    expect(moduleSource).toContain('getDistractorFeedback(question.id, question.answer)');
    expect(moduleSource).toContain('Why the other choices are weaker');
  });

  test('keeps distractor feedback separate from canonical question data', () => {
    expect(read('data/curriculum/lesson-content.json')).not.toContain('Why the other choices are weaker');
    expect(moduleSource).toContain('const distractorFeedback = getDistractorFeedback');
    expect(moduleSource.indexOf('const distractorFeedback = getDistractorFeedback'))
      .toBeGreaterThan(moduleSource.indexOf('function checkAnswer'));
  });

  test('renders a directional battery architecture instead of disconnected boxes', () => {
    expect(visuals).toContain('kind:"architecture"');
    expect(visuals).toContain('primary:["Cells / Modules","Sensors","Control","Switching"]');
    expect(visuals).toContain('module-architecture-arrow');
    expect(visuals).toContain('Protection influences switching and system response');
    expect(visuals).toContain('Thermal conditions influence control and protection');
  });

  test('adds diagnostic caution to the battery evidence table', () => {
    expect(visuals).toContain('"Diagnostic caution"');
    expect(visuals).toContain('Verify measurement quality and operating context');
    expect(visuals).toContain('Depends on model assumptions and input data');
    expect(visuals).toContain('Shows requested behavior, not actual response');
    expect(visuals).toContain('Treat as a hypothesis, not failure proof');
  });

  test('syncs the project-authored reasoning visual to the current question focus', () => {
    expect(visuals).toContain('data-visual-reasoning-step');
    expect(visuals).toContain('setModuleVisualReasoningStep');
    expect(moduleSource).toContain('setModuleVisualReasoningStep(step)');
  });
});
