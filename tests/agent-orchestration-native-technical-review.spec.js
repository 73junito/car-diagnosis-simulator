'use strict';

const fs = require('fs');
const path = require('path');
const {
  TECHNICAL_REVIEW_CHECKLIST_VERSION,
  stableTechnicalReviewEvidenceHash,
  buildTechnicalReviewEvidence,
  assertTechnicalReviewContainment,
} = require('../src/ai/runtime/native-technical-review');

const root = path.resolve(__dirname, '..');
const base = {
  provenanceId: '11111111-1111-1111-1111-111111111111',
  questionId: 'charging-system-native-review-01',
  payloadSha256: 'a'.repeat(64),
  reviewerId: '22222222-2222-2222-2222-222222222222',
  reviewerRole: 'technical_reviewer',
  reviewedAt: '2026-10-06T18:30:00.000Z',
  decision: 'pass',
  checklistCompleted: true,
  submittedBy: 'human-reviewer',
  comments: 'Reviewed against the approved evidence.',
};

describe('Phase 10E native human technical review', () => {
  test('builds deterministic exact-payload human review evidence', () => {
    const result = buildTechnicalReviewEvidence(base);
    expect(result.evidence).toMatchObject({
      payloadSha256: 'a'.repeat(64),
      decision: 'pass',
      checklistVersion: TECHNICAL_REVIEW_CHECKLIST_VERSION,
      checklistCompleted: true,
      allCriteriaPassed: true,
    });
    expect(result.evidence.criteriaReviewed).toHaveLength(5);
    expect(result.evidenceHash).toBe(stableTechnicalReviewEvidenceHash(result.evidence));
    expect(result.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('accepts completed revise/reject reviews without claiming criteria passed', () => {
    for (const decision of ['revise', 'reject']) {
      const result = buildTechnicalReviewEvidence({ ...base, decision });
      expect(result.evidence.checklistCompleted).toBe(true);
      expect(result.evidence.allCriteriaPassed).toBe(false);
    }
  });

  test('fails closed for ineligible reviewer roles or incomplete pass checklist', () => {
    expect(() => buildTechnicalReviewEvidence({ ...base, reviewerRole: 'teacher' }))
      .toThrow(/not eligible/);
    expect(() => buildTechnicalReviewEvidence({ ...base, checklistCompleted: false }))
      .toThrow(/requires the checklist to be completed/);
  });

  test('containment forbids public, eligibility, citation-validation, instructional, and approval authority', () => {
    const provenance = {
      status: 'draft',
      instructional_reviewer_id: null,
      instructional_reviewed_at: null,
      approved_by: null,
      approved_at: null,
    };
    expect(() => assertTechnicalReviewContainment({
      scenarioQuestionCount: 0,
      assessmentEligibilityCount: 0,
      citationValidationCount: 0,
      provenance,
    })).not.toThrow();
    expect(() => assertTechnicalReviewContainment({
      scenarioQuestionCount: 1,
      assessmentEligibilityCount: 0,
      citationValidationCount: 0,
      provenance,
    })).toThrow(/public scenario_questions/);
    expect(() => assertTechnicalReviewContainment({
      scenarioQuestionCount: 0,
      assessmentEligibilityCount: 0,
      citationValidationCount: 1,
      provenance,
    })).toThrow(/citation validation/);
  });

  test('workflow requires human inputs and contains no content promotion path', () => {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'record-native-question-technical-review.yml'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'scripts', 'record-native-question-technical-review.js'), 'utf8');

    expect(workflow).toContain('reviewer_id:');
    expect(workflow).toContain('reviewed_payload_sha256:');
    expect(workflow).toContain('checklist_completed:');
    expect(workflow).toContain('decision:');
    expect(workflow).toContain('group: native-technical-review-${{ inputs.governed_run_id }}');
    expect(workflow).not.toContain('OLLAMA_API_KEY');

    expect(script).toContain(".from('profiles')");
    expect(script).toContain("reviewer.role === 'developer_reviewer' || reviewer.role === 'technical_reviewer'");
    expect(script).toContain("decision !== 'pass'");
    expect(script).toContain('recordTechnicalReview');
    expect(script).not.toMatch(/\.from\('scenario_questions'\)[\s\S]{0,300}\.insert\(/);
    expect(script).not.toMatch(/\.from\('citation_validations'\)[\s\S]{0,300}\.(insert|update)\(/);
    expect(script).not.toContain('final_content_approved');
  });
});
