const fs = require('fs');
const path = require('path');

describe('AUT-250 training question bank', () => {
  const curriculum = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'curriculum', 'lesson-content.json'), 'utf8')
  );
  const aut250 = curriculum.lessonContentPlans.find((plan) => plan.lessonPlanId === 'ug-hev-foundations');
  const modules = aut250.courseModules || [];
  const questions = modules.flatMap((module) => module.trainingQuestions || []);

  test('contains exactly 40 unique approved training questions across six modules', () => {
    expect(modules).toHaveLength(6);
    expect(questions).toHaveLength(40);
    expect(new Set(questions.map((question) => question.id)).size).toBe(40);
    expect(new Set(questions.map((question) => question.stem.trim())).size).toBe(40);
    expect(modules.map((module) => (module.trainingQuestions || []).length))
      .toEqual([8, 8, 6, 6, 6, 6]);
  });

  test('keeps every AUT-250 item approved only for formative training and non-assessment use', () => {
    for (const question of questions) {
      expect(question.status).toBe('approved-for-training-use');
      expect(question.deliveryMode).toBe('training');
      expect(question.scored).toBe(false);
      expect(question.highStakesEligible).toBe(false);
      expect(question.institutionalAssessmentEligible).toBe(false);
      expect(question.productionAssessmentApiEligible).toBe(false);
      expect(question.provenanceStatus).toBe('human-reviewed');
      expect(question.citationValidationStatus).toBe('metadata-preflight-valid');
      expect(question.authorship).toBe('project-authored');
      expect(['aut250-training-batch-001', 'aut250-training-batch-002-ollama-repaired'])
        .toContain(question.approvalBatch);
      expect(question.answer).toMatch(/^[A-D]$/);
      expect(Object.keys(question.choices)).toEqual(['A', 'B', 'C', 'D']);
      expect(question.explanation.length).toBeGreaterThan(40);
    }
  });

  test('records both approved batches without changing assessment eligibility', () => {
    const bank = aut250.trainingQuestionBank;
    expect(bank.totalQuestions).toBe(40);
    expect(bank.status).toBe('approved-for-training-use');
    expect(bank.deliveryMode).toBe('training');
    expect(bank.questionApprovalEffect).toBe('training-use-only');
    expect(bank.approvedBatches).toEqual([
      'aut250-training-batch-001',
      'aut250-training-batch-002-ollama-repaired'
    ]);
    expect(bank.approvalRecords).toHaveLength(2);
    expect(bank.releaseGate).toBe('both-final-approval-records-required');
    expect(bank.assessmentBoundary).toMatch(/non-scored/i);
    expect(bank.assessmentBoundary).toMatch(/not eligible for high-stakes, institutional, or production assessment api use/i);
  });

  test('contains no question-specific universal service thresholds or procedures', () => {
    for (const question of questions) {
      const serialized = JSON.stringify(question).toLowerCase();
      expect(serialized).not.toMatch(/wait\s+\d+\s*(seconds|minutes)/);
      expect(serialized).not.toMatch(/class\s+[0-9]+\s+glove/);
      expect(serialized).not.toMatch(/replace[^.]{0,120}(pack|inverter|converter)[^.]{0,120}when[^.]{0,40}\d/);
      expect(serialized).not.toMatch(/must measure exactly/);
    }
  });
});
