'use strict';

const fs = require('fs');
const path = require('path');
const {
  ELIGIBLE_PROVISIONED_ROLE,
  normalizeReviewerEmail,
  assertReviewerProvisioningAttestations,
  shouldResendInvite,
  validateExistingProfileForProvisioning,
} = require('../src/ai/runtime/instructional-reviewer-provisioning');

const root = path.resolve(__dirname, '..');

describe('production instructional reviewer provisioning', () => {
  test('uses a dedicated instructional reviewer role', () => {
    expect(ELIGIBLE_PROVISIONED_ROLE).toBe('instructional_reviewer');
  });

  test('normalizes and validates reviewer email', () => {
    expect(normalizeReviewerEmail(' Reviewer@Example.COM ')).toBe('reviewer@example.com');
    expect(() => normalizeReviewerEmail('not-an-email')).toThrow(/invalid/);
  });

  test('requires all human provisioning attestations', () => {
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
  });

  test('only promotes fresh invite student profiles and never repurposes existing accounts', () => {
    const fresh = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'reviewer@example.com',
      role: 'student',
    };
    expect(validateExistingProfileForProvisioning({
      profile: fresh,
      createdByThisRun: true,
      expectedUserId: fresh.id,
      expectedEmail: fresh.email,
    })).toBe('promote-fresh-invite');

    expect(() => validateExistingProfileForProvisioning({
      profile: fresh,
      createdByThisRun: false,
      expectedUserId: fresh.id,
      expectedEmail: fresh.email,
    })).toThrow(/cannot be repurposed/);
  });

  test('resends only for an existing unconfirmed instructional reviewer', () => {
    expect(shouldResendInvite({
      createdByThisRun: false,
      emailConfirmedAt: null,
      profileRole: 'instructional_reviewer',
    })).toBe(true);
    expect(shouldResendInvite({
      createdByThisRun: false,
      emailConfirmedAt: '2026-10-06T21:30:00.000Z',
      profileRole: 'instructional_reviewer',
    })).toBe(false);
    expect(shouldResendInvite({
      createdByThisRun: true,
      emailConfirmedAt: null,
      profileRole: 'student',
    })).toBe(false);
    expect(() => shouldResendInvite({
      createdByThisRun: false,
      emailConfirmedAt: null,
      profileRole: 'technical_reviewer',
    })).toThrow(/existing instructional reviewer/);
  });

  test('workflow uses a protected email secret and grants no downstream authority', () => {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'provision-production-instructional-reviewer.yml'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'scripts', 'provision-instructional-reviewer.js'), 'utf8');

    expect(workflow).toContain('INSTRUCTIONAL_REVIEWER_EMAIL: ${{ secrets.INSTRUCTIONAL_REVIEWER_EMAIL }}');
    expect(workflow).toContain('independence_attested:');
    expect(workflow).toContain('qualification_attested:');
    expect(workflow).toContain('authorization_attested:');
    expect(script).toContain("governance_scope: 'native-question-instructional-review'");
    expect(script).toContain("technicalReviewAuthority: false");
    expect(script).toContain("assessmentAuthority: false");
    expect(script).toContain("finalApprovalAuthority: false");
    expect(script).not.toContain('recordInstructionalReview');
    expect(script).not.toContain('recordHumanTransition');
  });
});
