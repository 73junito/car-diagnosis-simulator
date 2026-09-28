const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

describe('AUT-250 approved formative training learner release', () => {
  const approvals = [
    ['data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json',
      'exam-site/data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json',
      'aut250-training-batch-001'],
    ['data/evidence/approval-records/aut250-training-batch-002-final-approval-20260928.json',
      'exam-site/data/evidence/approval-records/aut250-training-batch-002-final-approval-20260928.json',
      'aut250-training-batch-002-ollama-repaired']
  ];
  const scriptRel = 'exam-site/lesson-plans/lesson-plans.js';

  test('serves exact mirrors of both final training approval credentials', () => {
    for (const [approvalRel, mirrorRel, batch] of approvals) {
      expect(json(mirrorRel)).toEqual(json(approvalRel));
      const approval = json(mirrorRel);
      expect(approval.question_batch).toBe(batch);
      expect(approval.question_count).toBe(20);
      expect(approval.requested_final_decision.decision).toBe('approved');
      expect(approval.requested_final_decision.scope).toBe('training-bank-final-approval-only');
      expect(approval.release_state.training_bank_final_approval).toBe('approved-for-training-use');
      expect(approval.approval_effect_if_confirmed.training_delivery_allowed).toBe(true);
      expect(approval.approval_effect_if_confirmed.scored).toBe(false);
      expect(approval.approval_effect_if_confirmed.high_stakes_eligible).toBe(false);
      expect(approval.approval_effect_if_confirmed.institutional_assessment_eligible).toBe(false);
      expect(approval.approval_effect_if_confirmed.production_assessment_api_eligible).toBe(false);
      expect(approval.release_state.production_release).toBe(false);
      expect(approval.release_state.assessment_release).toBe(false);
    }
  });

  test('retains the approved 40-question 8/8/6/6/6/6 formative distribution', () => {
    const curriculum = json('data/curriculum/lesson-content.json');
    const plan = curriculum.lessonContentPlans.find((item) => item.lessonPlanId === 'ug-hev-foundations');
    const counts = plan.courseModules.map((module) => module.trainingQuestions.length);
    const questions = plan.courseModules.flatMap((module) => module.trainingQuestions);
    expect(counts).toEqual([8, 8, 6, 6, 6, 6]);
    expect(questions).toHaveLength(40);
    expect(questions.every((q) => q.status === 'approved-for-training-use')).toBe(true);
    expect(questions.every((q) => q.scored === false)).toBe(true);
    expect(questions.every((q) => q.highStakesEligible === false)).toBe(true);
    expect(questions.every((q) => q.institutionalAssessmentEligible === false)).toBe(true);
    expect(questions.every((q) => q.productionAssessmentApiEligible === false)).toBe(true);
    expect(questions.every((q) => q.deliveryMode === 'training')).toBe(true);
  });

  test('learner renderer fails closed unless both final approval credentials pass', () => {
    const source = read(scriptRel);
    expect(source).toContain('AUT250_TRAINING_APPROVALS');
    expect(source).toContain('aut250-training-batch-001-final-approval-20260927.json');
    expect(source).toContain('aut250-training-batch-002-final-approval-20260928.json');
    expect(source).toContain('loadTrainingApprovals');
    expect(source).toContain('evaluateAut250TrainingRelease');
    expect(source).toContain('allRequiredBatchesPresent');
    expect(source).toContain('allRequiredBatchesApproved');
    expect(source).toContain('decision?.decision === "approved"');
    expect(source).toContain('release?.training_bank_final_approval === "approved-for-training-use"');
    expect(source).toContain('effect?.scored === false');
    expect(source).toContain('effect?.high_stakes_eligible === false');
    expect(source).toContain('effect?.production_assessment_api_eligible === false');
    expect(source).toContain('data-training-release-blocked');
    expect(source).toContain('if (trainingReleaseGate.approved)');
    expect(source).toContain('aut250TrainingQuestions = "blocked"');
  });

  test('learner-facing copy preserves the formative-only boundary', () => {
    const source = read(scriptRel);
    expect(source).toContain('Training bank: approved for formative training use');
    expect(source).toContain('not eligible for high-stakes assessment');
    expect(source).toContain('not eligible for institutional assessment');
    expect(source).toContain('not released to the production assessment API');
    expect(source).not.toContain('citation review pending');
    expect(source).not.toContain('provenance and citation validation pending');
  });

  test('AUT-250 training question IDs do not appear in exam or assessment API source paths', () => {
    const curriculum = json('data/curriculum/lesson-content.json');
    const plan = curriculum.lessonContentPlans.find((item) => item.lessonPlanId === 'ug-hev-foundations');
    const ids = plan.courseModules.flatMap((module) => module.trainingQuestions.map((q) => q.id));
    const forbiddenRoots = [
      path.join(ROOT, 'exam-site', 'exam'),
      path.join(ROOT, 'api'),
      path.join(ROOT, 'worker')
    ];
    const files = forbiddenRoots.flatMap(walk)
      .filter((file) => /\.(js|mjs|cjs|ts|tsx|json|html)$/i.test(file));
    const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    for (const id of ids) expect(combined).not.toContain(id);
  });
});
