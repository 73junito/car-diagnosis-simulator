'use strict';

const fs = require('fs');
const path = require('path');
const {
  INSTRUCTIONAL_REVIEW_CHECKLIST_VERSION,
  stableInstructionalReviewEvidenceHash,
  buildInstructionalReviewEvidence,
  assertInstructionalReviewContainment,
} = require('../src/ai/runtime/native-instructional-review');

const root = path.resolve(__dirname, '..');
const base = {
  provenanceId: '11111111-1111-1111-1111-111111111111',
  questionId: 'charging-system-native-instructional-01',
  payloadSha256: 'a'.repeat(64),
  citationSetHash: 'b'.repeat(64),
  citationValidationEvidenceHash: 'c'.repeat(64),
  reviewerId: '22222222-2222-2222-2222-222222222222',
  reviewerRole: 'instructional_reviewer',
  technicalReviewerId: '33333333-3333-3333-3333-333333333333',
  reviewedAt: '2026-10-06T21:00:00.000Z',
  decision: 'pass',
  checklistCompleted: true,
  submittedBy: 'human-reviewer',
  comments: 'Reviewed for instructional quality.',
};

describe('Phase 10G native human instructional review', () => {
  test('builds deterministic evidence bound to payload and citation validation', () => {
    const result = buildInstructionalReviewEvidence(base);
    expect(result.evidence).toMatchObject({
      payloadSha256: 'a'.repeat(64),
      citationSetHash: 'b'.repeat(64),
      citationValidationEvidenceHash: 'c'.repeat(64),
      decision: 'pass',
      checklistVersion: INSTRUCTIONAL_REVIEW_CHECKLIST_VERSION,
      checklistCompleted: true,
      allCriteriaPassed: true,
    });
    expect(result.evidence.criteriaReviewed).toHaveLength(6);
    expect(result.evidenceHash).toBe(stableInstructionalReviewEvidenceHash(result.evidence));
    expect(result.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('requires independent instructional-review authority', () => {
    expect(() => buildInstructionalReviewEvidence({ ...base, reviewerRole: 'technical_reviewer' }))
      .toThrow(/not eligible/);
    expect(() => buildInstructionalReviewEvidence({ ...base, reviewerId: base.technicalReviewerId }))
      .toThrow(/independent/);
  });

  test('accepts completed revise/reject decisions without claiming all criteria passed', () => {
    for (const decision of ['revise', 'reject']) {
      const result = buildInstructionalReviewEvidence({ ...base, decision });
      expect(result.evidence.allCriteriaPassed).toBe(false);
    }
  });

  test('containment requires validated citations and forbids public/eligibility/final approval', () => {
    const provenance = {
      status: 'draft',
      technical_reviewer_id: base.technicalReviewerId,
      technical_reviewed_at: '2026-10-06T19:26:59.818Z',
      approved_by: null,
      approved_at: null,
    };
    const citationValidation = {
      result: 'valid',
      source_hashes_verified: true,
      excerpts_verified: true,
      urls_verified: true,
    };
    expect(() => assertInstructionalReviewContainment({
      scenarioQuestionCount: 0,
      assessmentEligibilityCount: 0,
      citationValidation,
      provenance,
    })).not.toThrow();
    expect(() => assertInstructionalReviewContainment({
      scenarioQuestionCount: 1,
      assessmentEligibilityCount: 0,
      citationValidation,
      provenance,
    })).toThrow(/public scenario_questions/);
    expect(() => assertInstructionalReviewContainment({
      scenarioQuestionCount: 0,
      assessmentEligibilityCount: 0,
      citationValidation: { ...citationValidation, urls_verified: false },
      provenance,
    })).toThrow(/URL validation/);
  });

  test('workflow requires explicit human inputs and contains no promotion path', () => {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'record-native-question-instructional-review.yml'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'scripts', 'record-native-question-instructional-review.js'), 'utf8');

    expect(workflow).toContain('reviewer_id:');
    expect(workflow).toContain('reviewed_payload_sha256:');
    expect(workflow).toContain('checklist_completed:');
    expect(workflow).toContain('decision:');
    expect(workflow).toContain('group: native-instructional-review-${{ inputs.governed_run_id }}');
    expect(workflow).not.toContain('OLLAMA_API_KEY');

    expect(script).toContain("reviewer.role === 'instructional_reviewer'");
    expect(script).toContain("governance_scope === 'native-question-instructional-review'");
    expect(script).toContain('reviewerId !== provenance.technical_reviewer_id');
    expect(script).toContain('recordInstructionalReview');
    expect(script).not.toMatch(/\.from\('scenario_questions'\)[\s\S]{0,300}\.insert\(/);
    expect(script).not.toMatch(/\.from\('assessment_question_eligibility'\)[\s\S]{0,300}\.(insert|update)\(/);
    expect(script).not.toContain('recordHumanTransition(');
  });
});
