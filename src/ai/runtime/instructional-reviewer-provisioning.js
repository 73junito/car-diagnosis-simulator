'use strict';

const ELIGIBLE_PROVISIONED_ROLE = 'instructional_reviewer';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeReviewerEmail(email) {
  requireCondition(typeof email === 'string', 'Reviewer email is required.');
  const normalized = email.trim().toLowerCase();
  requireCondition(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized), 'Reviewer email is invalid.');
  return normalized;
}

function assertReviewerProvisioningAttestations({
  independenceAttested,
  qualificationAttested,
  authorizationAttested,
}) {
  requireCondition(independenceAttested === true, 'Reviewer independence attestation is required.');
  requireCondition(qualificationAttested === true, 'Reviewer instructional qualification attestation is required.');
  requireCondition(authorizationAttested === true, 'Reviewer provisioning authorization attestation is required.');
}

function shouldResendInvite({ createdByThisRun, emailConfirmedAt, profileRole }) {
  if (createdByThisRun) return false;
  requireCondition(
    profileRole === ELIGIBLE_PROVISIONED_ROLE,
    'Invite resend requires an existing instructional reviewer profile.'
  );
  return !emailConfirmedAt;
}

function validateExistingProfileForProvisioning({
  profile,
  createdByThisRun,
  expectedUserId,
  expectedEmail,
}) {
  requireCondition(profile && profile.id === expectedUserId, 'Reviewer profile identity mismatch.');
  if (profile.email) {
    requireCondition(
      String(profile.email).trim().toLowerCase() === expectedEmail,
      'Reviewer profile email mismatch.'
    );
  }

  if (createdByThisRun) {
    requireCondition(
      profile.role === 'student' || profile.role === ELIGIBLE_PROVISIONED_ROLE,
      'Fresh invited reviewer profile has an unexpected role.'
    );
    return profile.role === ELIGIBLE_PROVISIONED_ROLE ? 'already-provisioned' : 'promote-fresh-invite';
  }

  requireCondition(
    profile.role === ELIGIBLE_PROVISIONED_ROLE,
    'Pre-existing Auth accounts cannot be repurposed as instructional reviewers.'
  );
  return 'already-provisioned';
}

module.exports = {
  ELIGIBLE_PROVISIONED_ROLE,
  normalizeReviewerEmail,
  assertReviewerProvisioningAttestations,
  shouldResendInvite,
  validateExistingProfileForProvisioning,
};
