#!/usr/bin/env node
'use strict';

/**
 * Read-only report of the restored project's GoTrue configuration, answering one question:
 * is email/password sign-in available for a dedicated test user?
 *
 * This is a REPORTING step. It performs exactly one unauthenticated GET to /auth/v1/settings with
 * the project's existing anonymous key. It does not sign in, does not create or read users, and does
 * not modify any Auth setting.
 *
 * Output discipline:
 *   - the API key is never printed, logged or written anywhere;
 *   - no request headers and no raw response body are emitted;
 *   - only the allowlisted fields below reach the log, plus one machine-readable record with a
 *     stable prefix.
 *
 * A failed probe is classified `uncertain`, never `disabled`: an HTTP error, a non-JSON body or a
 * missing field says nothing about whether the provider is enabled.
 *
 * Bound to the restored project only. The reference is checked before any request, so this script
 * cannot be repointed at staging or production by changing an environment variable.
 *
 * Usage: node scripts/report-restored-auth-config.cjs
 * Exit:  0 probe succeeded (whatever the settings say) · 1 probe or configuration failed
 */

const { PROJECT_REF } = require('./smoke-restored-supabase-access.cjs');

const SETTINGS_URL = 'https://' + PROJECT_REF + '.supabase.co/auth/v1/settings';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 100000;
const RECORD_PREFIX = 'AUTH_SETTINGS ';

/** The complete set of fields this script may emit. Anything else stays in memory. */
const RECORD_FIELDS = Object.freeze([
  'ref',
  'probe',
  'httpStatus',
  'emailProvider',
  'phoneProvider',
  'disableSignup',
  'mailerAutoconfirm',
  'passwordGrant',
  'signup',
  'emailConfirmation',
  'reason',
]);

/** Tri-state read: true/false only when the value really is a boolean, otherwise null (unknown). */
function boolOrNull(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

/**
 * Derive the allowlisted values from a settings payload. `reason` names every field that was missing
 * or not a boolean, so "uncertain" is always explained rather than silently read as "off".
 */
function classifySettings(payload) {
  const isObject = Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload);
  const external = isObject ? payload.external : null;
  const externalIsObject = Boolean(external) && typeof external === 'object' && !Array.isArray(external);

  const emailProvider = externalIsObject ? boolOrNull(external.email) : null;
  const phoneProvider = externalIsObject ? boolOrNull(external.phone) : null;
  const disableSignup = isObject ? boolOrNull(payload.disable_signup) : null;
  const mailerAutoconfirm = isObject ? boolOrNull(payload.mailer_autoconfirm) : null;

  const unknown = [];
  if (emailProvider === null) unknown.push('external.email');
  if (disableSignup === null) unknown.push('disable_signup');
  if (mailerAutoconfirm === null) unknown.push('mailer_autoconfirm');

  return {
    emailProvider,
    phoneProvider,
    disableSignup,
    mailerAutoconfirm,
    passwordGrant: emailProvider === true ? 'supported' : emailProvider === false ? 'disabled' : 'uncertain',
    signup: disableSignup === true ? 'restricted' : disableSignup === false ? 'open' : 'uncertain',
    emailConfirmation:
      mailerAutoconfirm === true ? 'auto-confirmed' : mailerAutoconfirm === false ? 'required' : 'uncertain',
    reason: unknown.length === 0 ? 'ok' : 'missing-or-invalid:' + unknown.join(','),
  };
}

function baseRecord(overrides) {
  return {
    ref: PROJECT_REF,
    probe: 'failed',
    httpStatus: null,
    emailProvider: null,
    phoneProvider: null,
    disableSignup: null,
    mailerAutoconfirm: null,
    passwordGrant: 'uncertain',
    signup: 'uncertain',
    emailConfirmation: 'uncertain',
    reason: 'unclassified',
    ...overrides,
  };
}

function emitRecord(log, record) {
  // Fixed key order so the line is stable for parsers.
  const ordered = {};
  for (const field of RECORD_FIELDS) ordered[field] = record[field];
  log(RECORD_PREFIX + JSON.stringify(ordered));
  return ordered;
}

async function runReport({ env = process.env, fetchImpl = fetch, log = console.log, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  // Bind to the restored project before anything leaves the runner.
  if (env.EXPECTED_SUPABASE_REF !== PROJECT_REF) {
    const record = emitRecord(log, baseRecord({ probe: 'refused', reason: 'project-mismatch' }));
    return { status: 'refused', record };
  }

  const anonKey = env.RESTORED_SUPABASE_ANON_KEY;
  if (!anonKey) {
    const record = emitRecord(log, baseRecord({ probe: 'refused', reason: 'missing-api-key' }));
    return { status: 'refused', record };
  }

  let response;
  try {
    response = await fetchImpl(SETTINGS_URL, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      // apikey only: an anon/publishable key is an API key, not a bearer token, and this script must
      // never look like it is authenticating as a user.
      headers: { apikey: anonKey, Accept: 'application/json' },
    });
  } catch (error) {
    const name = error && error.name;
    const reason =
      name === 'TimeoutError' || name === 'AbortError' ? 'settings-http-timeout' : 'settings-network-error';
    const record = emitRecord(log, baseRecord({ reason }));
    return { status: 'failed', record };
  }

  if (!response || typeof response.status !== 'number') {
    const record = emitRecord(log, baseRecord({ reason: 'settings-unusable-response' }));
    return { status: 'failed', record };
  }

  const httpStatus = response.status;
  if (httpStatus !== 200) {
    const record = emitRecord(log, baseRecord({ httpStatus, reason: 'settings-http-' + httpStatus }));
    return { status: 'failed', record };
  }

  const text = await response.text();
  if (typeof text !== 'string' || text.length > MAX_RESPONSE_BYTES) {
    const record = emitRecord(log, baseRecord({ httpStatus, reason: 'settings-response-too-large' }));
    return { status: 'failed', record };
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    const record = emitRecord(log, baseRecord({ httpStatus, reason: 'settings-body-not-json' }));
    return { status: 'failed', record };
  }

  const record = emitRecord(log, baseRecord({ probe: 'ok', httpStatus, ...classifySettings(payload) }));
  return { status: 'ok', record };
}

async function main() {
  const { status } = await runReport();
  if (status !== 'ok') {
    console.error('FAIL restored-project Auth settings probe:', status);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  runReport,
  classifySettings,
  boolOrNull,
  emitRecord,
  SETTINGS_URL,
  RECORD_PREFIX,
  RECORD_FIELDS,
};

