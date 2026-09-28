const fs = require('fs');
const path = require('path');

describe('AUT-250 training question bank', () => {
  const curriculum = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'curriculum', 'lesson-content.json'), 'utf8')
  );
  const aut250 = curriculum.lessonContentPlans.find((plan) => plan.lessonPlanId === 'ug-hev-foundations');
  const modules = aut250.courseModules || [];
  const questions = modules.flatMap((module) => module.trainingQuestions || []);

  test('contains exactly 20 unique training questions across six modules', () => {
    expect(modules).toHaveLength(6);
    expect(questions).toHaveLength(20);
    expect(new Set(questions.map((question) => question.id)).size).toBe(20);
    expect(new Set(questions.map((question) => question.stem.trim())).size).toBe(20);
    expect(modules.map((module) => (module.trainingQuestions || []).length))
      .toEqual([4, 4, 3, 3, 3, 3]);
  });

  test('keeps every AUT-250 item draft, training-only, and non-high-stakes', () => {
    for (const question of questions) {
      expect(question.status).toBe('draft');
      expect(question.deliveryMode).toBe('training');
      expect(question.scored).toBe(false);
      expect(question.highStakesEligible).toBe(false);
      expect(question.provenanceStatus).toBe('pending-bulk-review');
      expect(question.citationValidationStatus).toBe('pending');
      expect(question.authorship).toBe('project-authored');
      expect(question.answer).toMatch(/^[A-D]$/);
      expect(Object.keys(question.choices)).toEqual(['A', 'B', 'C', 'D']);
      expect(question.explanation.length).toBeGreaterThan(40);
    }
  });

  test('records the 20-question bulk review trigger without approval effect', () => {
    expect(aut250.trainingQuestionBank.totalQuestions).toBe(20);
    expect(aut250.trainingQuestionBank.status).toBe('draft');
    expect(aut250.trainingQuestionBank.deliveryMode).toBe('training');
    expect(aut250.trainingQuestionBank.questionApprovalEffect).toBe('none');
    expect(aut250.trainingQuestionBank.reviewTrigger).toMatch(/20-question threshold reached/i);
    expect(aut250.trainingQuestionBank.assessmentBoundary).toMatch(/not served by the approved assessment API/i);
  });

  test('contains no question-specific universal service thresholds or procedures', () => {
    const serialized = JSON.stringify(questions).toLowerCase();
    expect(serialized).not.toMatch(/wait\s+\d+\s*(seconds|minutes)/);
    expect(serialized).not.toMatch(/class\s+[0-9]+\s+glove/);
    expect(serialized).not.toMatch(/replace.*(pack|inverter|converter).*when.*\d/);
    expect(serialized).not.toMatch(/must measure exactly/);
  });
});
