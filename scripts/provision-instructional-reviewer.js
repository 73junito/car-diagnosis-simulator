'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  ELIGIBLE_PROVISIONED_ROLE,
  normalizeReviewerEmail,
  assertReviewerProvisioningAttestations,
  isEmailSendRateLimitError,
  shouldResendInvite,
  validateExistingProfileForProvisioning,
} = require('../src/ai/runtime/instructional-reviewer-provisioning');

const reviewerEmail = normalizeReviewerEmail(process.env.INSTRUCTIONAL_REVIEWER_EMAIL || '');
const provisionedBy = process.env.GITHUB_ACTOR || process.env.REVIEWER_PROVISIONED_BY || '';
const independenceAttested = process.env.REVIEWER_INDEPENDENCE_ATTESTED === 'true';
const qualificationAttested = process.env.REVIEWER_QUALIFICATION_ATTESTED === 'true';
const authorizationAttested = process.env.REVIEWER_AUTHORIZATION_ATTESTED === 'true';
const inviteArtifactPath = process.env.INSTRUCTIONAL_REVIEWER_INVITE_ARTIFACT_PATH || '';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function findAuthUserByEmail(client, email) {
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((user) => String(user.email || '').trim().toLowerCase() === email);
    if (found) return found;
    if (users.length < perPage) return null;
  }
  throw new Error('Auth user scan exceeded the supported pagination bound.');
}

function writeInviteArtifact(actionLink) {
  requireCondition(inviteArtifactPath.length > 0, 'Secure invite artifact path is required for SMTP rate-limit fallback.');
  requireCondition(typeof actionLink === 'string' && actionLink.startsWith('https://'), 'Generated invite action link is invalid.');
  fs.mkdirSync(path.dirname(inviteArtifactPath), { recursive: true });
  fs.writeFileSync(inviteArtifactPath, `${actionLink}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function generateInviteLinkFallback(client, email, expectedUserId = null) {
  const { data, error } = await client.auth.admin.generateLink({ type: 'invite', email });
  if (error) throw error;
  const generatedUser = data?.user || null;
  const actionLink = data?.properties?.action_link || '';
  requireCondition(generatedUser?.id, 'Supabase did not return the generated invite reviewer identity.');
  if (expectedUserId) {
    requireCondition(generatedUser.id === expectedUserId, 'Generated invite link returned a different reviewer identity.');
  }
  writeInviteArtifact(actionLink);
  return generatedUser;
}

async function inviteWithRateLimitFallback(client, email, expectedUserId = null) {
  const { data, error } = await client.auth.admin.inviteUserByEmail(email);
  if (!error) {
    const invitedUser = data?.user || null;
    requireCondition(invitedUser?.id, 'Supabase did not return the invited reviewer identity.');
    if (expectedUserId) {
      requireCondition(invitedUser.id === expectedUserId, 'Invite returned a different reviewer identity.');
    }
    return { user: invitedUser, delivery: 'email' };
  }

  if (!isEmailSendRateLimitError(error)) throw error;
  const generatedUser = await generateInviteLinkFallback(client, email, expectedUserId);
  return { user: generatedUser, delivery: 'secure-link-artifact' };
}

(async () => {
  requireCondition(process.env.TORQUEMIND_ENVIRONMENT === 'production', 'Reviewer provisioning is production-only.');
  requireCondition(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY, 'Production Supabase credentials are required.');
  requireCondition(provisionedBy.length > 0, 'Provisioning actor is required.');
  assertReviewerProvisioningAttestations({
    independenceAttested,
    qualificationAttested,
    authorizationAttested,
  });

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let user = await findAuthUserByEmail(client, reviewerEmail);
  const createdByThisRun = !user;
  let inviteDelivery = 'not-required';

  if (!user) {
    const inviteResult = await inviteWithRateLimitFallback(client, reviewerEmail);
    user = inviteResult.user;
    inviteDelivery = inviteResult.delivery;
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id,email,role,created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  requireCondition(profile, 'Reviewer profile was not created by the Auth profile trigger.');

  const assignment = validateExistingProfileForProvisioning({
    profile,
    createdByThisRun,
    expectedUserId: user.id,
    expectedEmail: reviewerEmail,
  });

  if (assignment === 'promote-fresh-invite') {
    const { data: promoted, error: promoteError } = await client
      .from('profiles')
      .update({ role: ELIGIBLE_PROVISIONED_ROLE })
      .eq('id', user.id)
      .eq('role', 'student')
      .select('id,email,role')
      .maybeSingle();
    if (promoteError) throw promoteError;
    requireCondition(promoted?.role === ELIGIBLE_PROVISIONED_ROLE, 'Fresh reviewer profile promotion failed.');
  }

  let inviteResent = false;
  if (shouldResendInvite({
    createdByThisRun,
    emailConfirmedAt: user.email_confirmed_at,
    profileRole: profile.role,
  })) {
    const resendResult = await inviteWithRateLimitFallback(client, reviewerEmail, user.id);
    inviteDelivery = resendResult.delivery;
    inviteResent = true;
  }

  const { count: technicalIdentityCount, error: technicalIdentityError } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('id', user.id)
    .eq('role', 'technical_reviewer');
  if (technicalIdentityError) throw technicalIdentityError;
  requireCondition((technicalIdentityCount || 0) === 0, 'Instructional reviewer identity cannot also be the technical reviewer identity.');

  const currentAppMetadata = user.app_metadata && typeof user.app_metadata === 'object'
    ? user.app_metadata
    : {};
  const expectedAppMetadata = {
    ...currentAppMetadata,
    governance_role: ELIGIBLE_PROVISIONED_ROLE,
    governance_scope: 'native-question-instructional-review',
    reviewer_independence_attested: true,
    reviewer_qualification_attested: true,
    reviewer_provisioned_by: provisionedBy,
  };

  const metadataMatches =
    currentAppMetadata.governance_role === ELIGIBLE_PROVISIONED_ROLE &&
    currentAppMetadata.governance_scope === 'native-question-instructional-review' &&
    currentAppMetadata.reviewer_independence_attested === true &&
    currentAppMetadata.reviewer_qualification_attested === true;

  if (!metadataMatches) {
    const { error: updateUserError } = await client.auth.admin.updateUserById(user.id, {
      app_metadata: expectedAppMetadata,
    });
    if (updateUserError) throw updateUserError;
  }

  const { data: verifiedProfile, error: verifyProfileError } = await client
    .from('profiles')
    .select('id,email,role')
    .eq('id', user.id)
    .maybeSingle();
  if (verifyProfileError) throw verifyProfileError;
  requireCondition(verifiedProfile?.role === ELIGIBLE_PROVISIONED_ROLE, 'Reviewer profile verification failed.');

  const { data: verifiedUser, error: verifyUserError } = await client.auth.admin.getUserById(user.id);
  if (verifyUserError) throw verifyUserError;
  requireCondition(
    verifiedUser?.user?.app_metadata?.governance_role === ELIGIBLE_PROVISIONED_ROLE &&
    verifiedUser?.user?.app_metadata?.governance_scope === 'native-question-instructional-review',
    'Reviewer app_metadata verification failed.'
  );

  console.log(JSON.stringify({
    reviewerId: user.id,
    role: ELIGIBLE_PROVISIONED_ROLE,
    invitedByThisRun: createdByThisRun,
    inviteResent,
    inviteDelivery,
    secureInviteArtifactCreated: inviteDelivery === 'secure-link-artifact',
    profileVerified: true,
    appMetadataVerified: true,
    independenceAttested: true,
    qualificationAttested: true,
    reviewAuthorityScope: 'native-question-instructional-review',
    technicalReviewAuthority: false,
    assessmentAuthority: false,
    finalApprovalAuthority: false,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
