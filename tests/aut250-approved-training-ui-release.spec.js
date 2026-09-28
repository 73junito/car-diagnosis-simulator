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
  const approvalRel = 'data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json';
  const mirrorRel = 'exam-site/data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json';
  const scriptRel = 'exam-site/lesson-plans/lesson-plans.js';

  test('serves an exact mirror of the final training approval credential', () => {
    expect(json(mirrorRel)).toEqual(json(approvalRel));
    const approval = json(mirrorRel);
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
  });

  test('retains the approved 20-question 4/4/3/3/3/3 formative distribution', () => {
    const curriculum = json('data/curriculum/lesson-content.json');
    const plan = curriculum.lessonContentPlans.find((item) => item.lessonPlanId === 'ug-hev-foundations');
    const counts = plan.courseModules.map((module) => module.trainingQuestions.length);
    const questions = plan.courseModules.flatMap((module) => module.trainingQuestions);
    expect(counts).toEqual([4, 4, 3, 3, 3, 3]);
    expect(questions).toHaveLength(20);
    expect(questions.every((q) => q.scored === false)).toBe(true);
    expect(questions.every((q) => q.highStakesEligible === false)).toBe(true);
    expect(questions.every((q) => q.deliveryMode === 'training')).toBe(true);
  });

  test('learner renderer is fail-closed on the final approval credential', () => {
    const source = read(scriptRel);
    expect(source).toContain('AUT250_TRAINING_APPROVAL_URL');
    expect(source).toContain('evaluateAut250TrainingRelease');
    expect(source).toContain('Object.values(checks).every(Boolean)');
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
    expect(source).toContain('Approved for formative training use · non-scored');
    expect(source).toContain('not eligible for high-stakes assessment · not eligible for institutional assessment');
    expect(source).toContain('not released to the production assessment API');
    expect(source).not.toContain('citation review pending');
    expect(source).not.toContain('provenance and citation validation pending');
  });

  test('AUT-250 training question IDs do not appear in exam or assessment API source paths', () => {
    const forbiddenRoots = [
      path.join(ROOT, 'exam-site', 'exam'),
      path.join(ROOT, 'api'),
      path.join(ROOT, 'worker')
    ];
    const files = forbiddenRoots.flatMap(walk)
      .filter((file) => /\.(js|mjs|cjs|ts|tsx|json|html)$/i.test(file));
    const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(combined).not.toMatch(/aut250-m[1-6]-q0[1-4]/);
  });
});
