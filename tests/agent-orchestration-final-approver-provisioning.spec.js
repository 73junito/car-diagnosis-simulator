'use strict';

const fs = require('fs');
const path = require('path');
const {
  ELIGIBLE_PROVISIONED_ROLE,
  normalizeReviewerEmail,
  assertReviewerProvisioningAttestations,
  isEmailSendRateLimitError,
  shouldResendInvite,
  validateExistingProfileForProvisioning,
} = require('../src/ai/runtime/final-approver-provisioning');

const root = path.resolve(__dirname, '..');

describe('production final approver provisioning', () => {
  test('uses a dedicated final approver role', () => {
    expect(ELIGIBLE_PROVISIONED_ROLE).toBe('final_approver');
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

  test('recognizes only the Supabase email-send rate-limit condition', () => {
    expect(isEmailSendRateLimitError({ code: 'over_email_send_rate_limit' })).toBe(true);
    expect(isEmailSendRateLimitError({ message: 'email rate limit exceeded' })).toBe(true);
    expect(isEmailSendRateLimitError({ code: 'user_already_exists', message: 'already registered' })).toBe(false);
    expect(isEmailSendRateLimitError(null)).toBe(false);
  });

  test('resends only for an existing unconfirmed final approver', () => {
    expect(shouldResendInvite({
      createdByThisRun: false,
      emailConfirmedAt: null,
      profileRole: 'final_approver',
    })).toBe(true);
    expect(shouldResendInvite({
      createdByThisRun: false,
      emailConfirmedAt: '2026-10-06T21:30:00.000Z',
      profileRole: 'final_approver',
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
    })).toThrow(/existing final approver/);
  });

  test('workflow uses a protected email secret and grants no downstream authority', () => {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'provision-production-final-approver.yml'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'scripts', 'provision-final-approver.js'), 'utf8');

    expect(workflow).toContain('FINAL_APPROVER_EMAIL: ${{ secrets.FINAL_APPROVER_EMAIL }}');
    expect(workflow).toContain('independence_attested:');
    expect(workflow).toContain('qualification_attested:');
    expect(workflow).toContain('authorization_attested:');
    expect(workflow).toContain('name: final-approver-invite-link');
    const artifactPathLines = workflow
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => line.includes('FINAL_APPROVER_INVITE_ARTIFACT_PATH:'));
    expect(artifactPathLines).toEqual([
      '          FINAL_APPROVER_INVITE_ARTIFACT_PATH: ${{ runner.temp }}/final-approver-invite.txt',
    ]);
    expect(workflow).toContain('retention-days: 1');
    expect(workflow).toContain('if-no-files-found: ignore');
    expect(script).toContain("client.auth.admin.generateLink({ type: 'invite', email })");
    expect(script).toContain("delivery: 'secure-link-artifact'");
    expect(script).toContain("governance_scope: 'native-question-final-approval'");
    expect(script).toContain("technicalReviewAuthority: false");
    expect(script).toContain("assessmentAuthority: false");
    expect(script).toContain("finalApprovalAuthority: true");
    expect(script).toContain(".eq('id', contract.referenced_10G_evidence.provenance_id)");
    expect(script).toContain('Final approver identity cannot also be the technical reviewer identity.');
    expect(script).toContain('Final approver identity cannot also be the instructional reviewer identity.');
    expect(script).not.toContain('recordInstructionalReview');
    expect(script).not.toContain('recordFinalContentApproval');
    expect(script).not.toContain('recordHumanTransition');
  });
});
