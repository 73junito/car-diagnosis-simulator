'use strict';

const fs = require('fs');
const path = require('path');
const {
  ELIGIBLE_PROVISIONED_ROLE,
  normalizeReviewerEmail,
  assertReviewerProvisioningAttestations,
  validateExistingProfileForProvisioning,
} = require('../src/ai/runtime/technical-reviewer-provisioning');

const root = path.resolve(__dirname, '..');
const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('production technical reviewer provisioning', () => {
  test('normalizes reviewer email and rejects malformed values', () => {
    expect(normalizeReviewerEmail(' Reviewer@Example.COM ')).toBe('reviewer@example.com');
    expect(() => normalizeReviewerEmail('not-an-email')).toThrow(/invalid/);
  });

  test('requires all three human provisioning attestations', () => {
    expect(() => assertReviewerProvisioningAttestations({
      independenceAttested: true,
      qualificationAttested: true,
      authorizationAttested: true,
    })).not.toThrow();

    expect(() => assertReviewerProvisioningAttestations({
      independenceAttested: false,
      qualificationAttested: true,
      authorizationAttested: true,
    })).toThrow(/independence/);
    expect(() => assertReviewerProvisioningAttestations({
      independenceAttested: true,
      qualificationAttested: false,
      authorizationAttested: true,
    })).toThrow(/qualification/);
    expect(() => assertReviewerProvisioningAttestations({
      independenceAttested: true,
      qualificationAttested: true,
      authorizationAttested: false,
    })).toThrow(/authorization/);
  });

  test('allows only the student profile created by this invite to be promoted', () => {
    expect(validateExistingProfileForProvisioning({
      profile: { id: USER_ID, email: 'reviewer@example.com', role: 'student' },
      createdByThisRun: true,
      expectedUserId: USER_ID,
      expectedEmail: 'reviewer@example.com',
    })).toBe('promote-fresh-invite');

    expect(validateExistingProfileForProvisioning({
      profile: { id: USER_ID, email: 'reviewer@example.com', role: ELIGIBLE_PROVISIONED_ROLE },
      createdByThisRun: true,
      expectedUserId: USER_ID,
      expectedEmail: 'reviewer@example.com',
    })).toBe('already-provisioned');
  });

  test('never repurposes a pre-existing non-reviewer account', () => {
    for (const role of ['teacher', 'student', 'admin', 'instructional_reviewer']) {
      expect(() => validateExistingProfileForProvisioning({
        profile: { id: USER_ID, email: 'reviewer@example.com', role },
        createdByThisRun: false,
        expectedUserId: USER_ID,
        expectedEmail: 'reviewer@example.com',
      })).toThrow(/cannot be repurposed/);
    }

    expect(validateExistingProfileForProvisioning({
      profile: { id: USER_ID, email: 'reviewer@example.com', role: ELIGIBLE_PROVISIONED_ROLE },
      createdByThisRun: false,
      expectedUserId: USER_ID,
      expectedEmail: 'reviewer@example.com',
    })).toBe('already-provisioned');
  });

  test('workflow keeps reviewer email protected and provisioning separate from review decisions', () => {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'provision-production-technical-reviewer.yml'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'scripts', 'provision-technical-reviewer.js'), 'utf8');

    expect(workflow).toContain('TECHNICAL_REVIEWER_EMAIL: ${{ secrets.TECHNICAL_REVIEWER_EMAIL }}');
    expect(workflow).not.toMatch(/inputs:\s*[\s\S]*reviewer_email:/);
    expect(workflow).toContain('independence_attested:');
    expect(workflow).toContain('qualification_attested:');
    expect(workflow).toContain('authorization_attested:');
    expect(workflow).toContain('environment: pffdgqpynpbffbcnxmum_production');

    expect(script).toContain('inviteUserByEmail');
    expect(script).toContain('listUsers');
    expect(script).toContain('updateUserById');
    expect(script).toContain(".from('profiles')");
    expect(script).toContain("governance_role: ELIGIBLE_PROVISIONED_ROLE");
    expect(script).not.toContain('recordTechnicalReview');
    expect(script).not.toContain('question_provenance');
    expect(script).not.toContain('scenario_questions');
    expect(script).not.toContain('assessment_question_eligibility');
  });
});
