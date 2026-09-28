const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('AUT-250 Batch 002 supplemental training bank', () => {
  const base = json('data/curriculum/lesson-content.json');
  const supplement = json('data/curriculum/aut250-training-batch-002.json');
  const approval = json('data/evidence/approval-records/aut250-training-batch-002-final-approval-20260928.json');
  const mirror = json('exam-site/data/curriculum/aut250-training-batch-002.json');
  const approvalMirror = json('exam-site/data/evidence/approval-records/aut250-training-batch-002-final-approval-20260928.json');

  test('keeps Batch 001 immutable while Batch 002 contributes 20 supplemental questions', () => {
    const plan = base.lessonContentPlans.find((item) => item.lessonPlanId === 'ug-hev-foundations');
    const baseCounts = plan.courseModules.map((module) => module.trainingQuestions.length);
    const supplementalCounts = supplement.modules.map((module) => module.questions.length);
    expect(baseCounts).toEqual([4, 4, 3, 3, 3, 3]);
    expect(plan.courseModules.flatMap((module) => module.trainingQuestions)).toHaveLength(20);
    expect(supplement.questionCount).toBe(20);
    expect(supplementalCounts).toEqual([4, 4, 3, 3, 3, 3]);
    expect(supplement.modules.flatMap((module) => module.questions)).toHaveLength(20);
  });

  test('binds the supplemental bank to the explicit Batch 002 training approval', () => {
    expect(supplement.questionBatch).toBe('aut250-training-batch-002-ollama-repaired');
    expect(supplement.status).toBe('approved-for-training-use');
    expect(approval.requested_final_decision.decision).toBe('approved');
    expect(approval.release_state.training_bank_final_approval).toBe('approved-for-training-use');
    expect(mirror).toEqual(supplement);
    expect(approvalMirror).toEqual(approval);
  });

  test('preserves training-only boundaries on every supplemental item', () => {
    const questions = supplement.modules.flatMap((module) => module.questions);
    expect(new Set(questions.map((q) => q.id)).size).toBe(20);
    expect(new Set(questions.map((q) => q.stem.trim())).size).toBe(20);
    for (const question of questions) {
      expect(question.status).toBe('approved-for-training-use');
      expect(question.deliveryMode).toBe('training');
      expect(question.scored).toBe(false);
      expect(question.highStakesEligible).toBe(false);
      expect(question.institutionalAssessmentEligible).toBe(false);
      expect(question.productionAssessmentApiEligible).toBe(false);
      expect(question.provenanceStatus).toBe('human-reviewed');
      expect(question.citationValidationStatus).toBe('metadata-preflight-valid');
      expect(question.approvalBatch).toBe('aut250-training-batch-002-ollama-repaired');
    }
  });

  test('requires both approval credentials before supplemental learner release', () => {
    const lessonPlans = fs.readFileSync(path.join(ROOT, 'exam-site/lesson-plans/lesson-plans.js'), 'utf8');
    const player = fs.readFileSync(path.join(ROOT, 'exam-site/courses/aut-250/module/module.js'), 'utf8');
    expect(lessonPlans).toContain('AUT250_BATCH002_APPROVAL_URL');
    expect(lessonPlans).toContain('AUT250_BATCH002_CURRICULUM');
    expect(lessonPlans).toContain('mergeAut250Batch002');
    expect(lessonPlans).toContain('batch002Approved');
    expect(player).toContain('BATCH002_APPROVAL_URL');
    expect(player).toContain('BATCH002_CURRICULUM_URL');
    expect(player).toContain('mergeBatch002IntoModule');
    expect(player).toContain('aut250-training-batch-002-ollama-repaired');
  });
});
