'use strict';

const { createClient } = require('@supabase/supabase-js');
const {
  ELIGIBLE_PROVISIONED_ROLE,
  normalizeReviewerEmail,
  assertReviewerProvisioningAttestations,
  validateExistingProfileForProvisioning,
} = require('../src/ai/runtime/technical-reviewer-provisioning');

const reviewerEmail = normalizeReviewerEmail(process.env.TECHNICAL_REVIEWER_EMAIL || '');
const provisionedBy = process.env.GITHUB_ACTOR || process.env.REVIEWER_PROVISIONED_BY || '';
const independenceAttested = process.env.REVIEWER_INDEPENDENCE_ATTESTED === 'true';
const qualificationAttested = process.env.REVIEWER_QUALIFICATION_ATTESTED === 'true';
const authorizationAttested = process.env.REVIEWER_AUTHORIZATION_ATTESTED === 'true';

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

  if (!user) {
    const { data, error } = await client.auth.admin.inviteUserByEmail(reviewerEmail);
    if (error) throw error;
    user = data?.user || null;
    requireCondition(user?.id, 'Supabase did not return the invited reviewer identity.');
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

  const currentAppMetadata = user.app_metadata && typeof user.app_metadata === 'object'
    ? user.app_metadata
    : {};
  const expectedAppMetadata = {
    ...currentAppMetadata,
    governance_role: ELIGIBLE_PROVISIONED_ROLE,
    governance_scope: 'native-question-technical-review',
    reviewer_independence_attested: true,
    reviewer_qualification_attested: true,
    reviewer_provisioned_by: provisionedBy,
  };

  const metadataMatches =
    currentAppMetadata.governance_role === ELIGIBLE_PROVISIONED_ROLE &&
    currentAppMetadata.governance_scope === 'native-question-technical-review' &&
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
    verifiedUser?.user?.app_metadata?.governance_role === ELIGIBLE_PROVISIONED_ROLE,
    'Reviewer app_metadata verification failed.'
  );

  console.log(JSON.stringify({
    reviewerId: user.id,
    role: ELIGIBLE_PROVISIONED_ROLE,
    invitedByThisRun: createdByThisRun,
    profileVerified: true,
    appMetadataVerified: true,
    independenceAttested: true,
    qualificationAttested: true,
    reviewAuthorityScope: 'native-question-technical-review',
    assessmentAuthority: false,
    finalApprovalAuthority: false,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
