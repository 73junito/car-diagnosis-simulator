#!/usr/bin/env node
'use strict';

/**
 * Provision (or remove) a disposable teacher identity for a single staging
 * smoke workflow.
 *
 * The staging smoke workflows used to share one teacher identity. Because
 * GoTrue revokes every session a user holds when its password is reset, a
 * repair performed by one workflow revoked the sessions of the others. This
 * script creates one disposable identity per workflow so each run can repair
 * only its own identity.
 *
 * Safety rules enforced here:
 *   - The script refuses to run inside CI. Identities are provisioned by an
 *     operator, never by a workflow run.
 *   - The script refuses to touch any Supabase project other than the
 *     approved staging project.
 *   - The script refuses to provision the shared teacher identity.
 *   - The password is never printed.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SMOKE_TEACHER_EMAIL=... SMOKE_TEACHER_PASSWORD=... \
 *   node scripts/provision-smoke-teacher-identity.js
 *
 *   Add --cleanup to remove the identity again.
 */

const APPROVED_STAGING_SUPABASE_HOST = 'jchfruprqpeypdttvlam.supabase.co';
const STAGING_ENVIRONMENT = 'jchfruprqpeypdttvlam_staging';
const TIMEOUT = 15000;

const USAGE = `Usage:
  node scripts/provision-smoke-teacher-identity.js [--cleanup]

Required environment:
  SUPABASE_URL              approved staging Supabase URL
  SUPABASE_SERVICE_ROLE_KEY staging service role key
  SMOKE_TEACHER_EMAIL       disposable teacher email to provision
  SMOKE_TEACHER_PASSWORD    password for that identity

Optional environment:
  TEST_TEACHER_EMAIL        shared identity; provisioning it is refused
  SECRET_NAME_PREFIX        GitHub secret name prefix (default: SMOKE_TEACHER)`;

/**
 * Parse the supported command line arguments.
 *
 * @param {string[]} argv
 * @returns {{cleanup: boolean, help: boolean}}
 */
function parseArgs(argv = []) {
  const options = { cleanup: false, help: false };

  for (const arg of argv) {
    if (arg === '--cleanup') {
      options.cleanup = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

/**
 * Validate that this run is an operator run against the approved staging
 * project, and collect the credentials it may use.
 *
 * @param {object} env
 * @returns {{supabaseUrl: string, serviceRoleKey: string, email: string, password: string, secretNamePrefix: string}}
 */
function assertOperatorContext(env = process.env) {
  if (env.CI === 'true' || env.GITHUB_ACTIONS === 'true') {
    throw new Error(
      'Refusing to run inside CI. Smoke teacher identities are provisioned by an operator.'
    );
  }

  const supabaseUrl = (env.SUPABASE_URL || '').trim();
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required.');
  }

  let parsed;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error('SUPABASE_URL is not a valid URL.');
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== APPROVED_STAGING_SUPABASE_HOST ||
    parsed.port ||
    (parsed.pathname !== '/' && parsed.pathname !== '') ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Refusing to provision outside the approved staging Supabase project.');
  }

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const email = (env.SMOKE_TEACHER_EMAIL || '').trim();
  const password = env.SMOKE_TEACHER_PASSWORD || '';

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  }
  if (!email) {
    throw new Error('SMOKE_TEACHER_EMAIL is required.');
  }
  if (!password) {
    throw new Error('SMOKE_TEACHER_PASSWORD is required.');
  }

  const sharedEmail = (env.TEST_TEACHER_EMAIL || '').trim();
  if (sharedEmail && sharedEmail.toLowerCase() === email.toLowerCase()) {
    throw new Error(
      'Refusing to provision the shared teacher identity. Each smoke workflow needs its own disposable identity.'
    );
  }

  const secretNamePrefix = (env.SECRET_NAME_PREFIX || 'SMOKE_TEACHER').trim() || 'SMOKE_TEACHER';

  return { supabaseUrl, serviceRoleKey, email, password, secretNamePrefix };
}

/**
 * Create an Admin Auth request helper bound to the approved staging project.
 *
 * @param {object} options
 * @returns {(path: string, init?: object) => Promise<Response>}
 */
function createAdminRequest(options = {}) {
  const {
    supabaseUrl,
    serviceRoleKey,
    fetchImpl = fetch,
  } = options;

  const baseUrl = new URL(supabaseUrl).origin;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  return async function adminRequest(path, init = {}) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/auth/v1/admin/users${path}`, {
        ...init,
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT),
      });
    } catch {
      throw new Error('Admin Auth request failed.');
    }
    return response;
  };
}

/**
 * Find an auth user by email, paging through the Admin Auth listing.
 *
 * @param {object} options
 * @returns {Promise<object|null>}
 */
async function findUserByEmail(options = {}) {
  const { email, adminRequest, maxPages = 10, perPage = 200 } = options;
  const wanted = email.toLowerCase();

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await adminRequest(`?page=${page}&per_page=${perPage}`);
    if (!response.ok) {
      throw new Error(`Admin Auth listing failed with status ${response.status}.`);
    }

    const body = await response.json().catch(() => null);
    const users = body && Array.isArray(body.users) ? body.users : [];

    const match = users.find(
      (user) => user && typeof user.email === 'string' && user.email.toLowerCase() === wanted
    );
    if (match) return match;

    if (users.length < perPage) return null;
  }

  throw new Error('Admin Auth listing did not complete; refusing to guess whether the identity exists.');
}

/**
 * Provision the disposable teacher identity and its teacher profile.
 *
 * @param {object} options
 * @returns {Promise<{action: string, userId: string, email: string}>}
 */
async function provisionTeacherIdentity(options = {}) {
  const {
    supabaseUrl,
    serviceRoleKey,
    email,
    password,
    fetchImpl = fetch,
    createClientImpl = null,
  } = options;

  const adminRequest = createAdminRequest({ supabaseUrl, serviceRoleKey, fetchImpl });
  const existing = await findUserByEmail({ email, adminRequest });

  let userId;
  let action;

  if (existing) {
    userId = existing.id;
    const response = await adminRequest(`/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (!response.ok) {
      throw new Error(`Admin Auth update failed with status ${response.status}.`);
    }
    action = 'updated';
  } else {
    const response = await adminRequest('', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!response.ok) {
      throw new Error(`Admin Auth create failed with status ${response.status}.`);
    }
    const created = await response.json().catch(() => null);
    userId = created && created.id;
    if (!userId) {
      throw new Error('Admin Auth create did not return a user identity.');
    }
    action = 'created';
  }

  const createClient =
    createClientImpl || require('@supabase/supabase-js').createClient;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await admin
    .from('profiles')
    .upsert({ id: userId, email, role: 'teacher' }, { onConflict: 'id', returning: 'minimal' });
  if (error) {
    throw new Error(`Profile upsert failed: ${error.message || 'unknown error'}.`);
  }

  return { action, userId, email };
}

/**
 * Remove the disposable teacher identity and its teacher profile.
 *
 * @param {object} options
 * @returns {Promise<{action: string, userId: string|null, email: string}>}
 */
async function cleanupTeacherIdentity(options = {}) {
  const {
    supabaseUrl,
    serviceRoleKey,
    email,
    fetchImpl = fetch,
    createClientImpl = null,
  } = options;

  const adminRequest = createAdminRequest({ supabaseUrl, serviceRoleKey, fetchImpl });
  const existing = await findUserByEmail({ email, adminRequest });

  if (!existing) {
    return { action: 'absent', userId: null, email };
  }

  const userId = existing.id;
  const response = await adminRequest(`/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Admin Auth delete failed with status ${response.status}.`);
  }

  const createClient =
    createClientImpl || require('@supabase/supabase-js').createClient;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await admin.from('profiles').delete().eq('id', userId);
  if (error) {
    throw new Error(`Profile delete failed: ${error.message || 'unknown error'}.`);
  }

  return { action: 'deleted', userId, email };
}

/**
 * Print static setup instructions without logging environment-derived values.
 */
function printSecretCommands() {
  console.log('');
  console.log('Required GitHub Actions environment secrets (values are never printed):');
  console.log('  SMOKE_TEACHER_EMAIL     - dedicated smoke teacher address');
  console.log('  SMOKE_TEACHER_PASSWORD  - dedicated smoke teacher password');
  console.log('');
  console.log('Set these under Settings > Environments, then wire them to');
  console.log('DEDICATED_TEACHER_EMAIL / DEDICATED_TEACHER_PASSWORD in the workflow.');
}

/**
 * Entry point.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(USAGE);
    return;
  }

  const context = assertOperatorContext();

  if (options.cleanup) {
    const result = await cleanupTeacherIdentity(context);
    console.log('Cleanup complete.');
    return;
  }

  const result = await provisionTeacherIdentity(context);
  console.log("Provisioning complete.");
  printSecretCommands();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`ERROR: ${err && err.message ? err.message : err}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  assertOperatorContext,
  provisionTeacherIdentity,
  cleanupTeacherIdentity,
  findUserByEmail,
  main,
  USAGE,
  APPROVED_STAGING_SUPABASE_HOST,
  STAGING_ENVIRONMENT,
};
