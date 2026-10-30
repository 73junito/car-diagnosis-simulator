'use strict';
const { PROJECT_REF, classifyCredential, buildRequestHeaders, classifyBodyCode, classifyGatewayCode, describeFailure } = require('./smoke-restored-supabase-access.cjs');

/**
 * Machine-readable rejection reasons. The preflight must be diagnosable without ever printing the
 * token: the value is a bearer credential, and the CI log is not a safe place for any part of it.
 * Each code names the check that failed, nothing more.
 */
const TOKEN_ISSUE = Object.freeze({
  MISSING: 'missing-token',
  SEGMENTS: 'invalid-segment-count',
  ENCODING: 'malformed-payload-encoding',
  JSON: 'invalid-payload-json',
  CLAIMS: 'invalid-claims',
  EXPIRED: 'expired-token',
  PROJECT: 'project-mismatch',
  ISSUER: 'issuer-mismatch',
  CLOCK: 'clock-inconsistent',
});

const REQUIRED_CLAIMS_MESSAGE = 'Test-user JWT must have authenticated role, subject, and unexpired timestamp';

/**
 * Classify a candidate test-user token. Returns { code, detail } where code is null when the token
 * is structurally acceptable. `detail` is metadata only (segment counts, claim names) - never token
 * bytes, decoded payload text, claim values, or the signature.
 *
 * This is NOT signature verification: the header and claims stay untrusted until Supabase validates
 * them. It only rejects tokens that cannot possibly be a valid restored-project user token, so a
 * misconfigured secret fails with a precise reason instead of a network error that looks like an
 * authorization defect.
 */
function classifyTestToken(token, { nowSeconds = Math.floor(Date.now() / 1000), projectRef = PROJECT_REF } = {}) {
  if (typeof token !== 'string' || token.length === 0) {
    return { code: TOKEN_ISSUE.MISSING, detail: 'no token supplied' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { code: TOKEN_ISSUE.SEGMENTS, detail: `${parts.length} segment(s), expected 3` };
  }

  const payload = parts[1];
  // Reject anything that is not unpadded/padded base64url before decoding: Node's decoder silently
  // skips invalid characters, so a standard-base64 or otherwise mangled payload would otherwise be
  // reported as invalid JSON and send the reader looking in the wrong place.
  const base64url = /^[A-Za-z0-9_-]+={0,2}$/;
  if (!base64url.test(payload) || payload.split('=')[0].length % 4 === 1) {
    return { code: TOKEN_ISSUE.ENCODING, detail: 'payload is not base64url' };
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { code: TOKEN_ISSUE.JSON, detail: 'payload is not JSON' };
  }

  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
    return { code: TOKEN_ISSUE.CLAIMS, detail: 'claim: payload is not an object' };
  }
  if (claims.role !== 'authenticated') {
    return { code: TOKEN_ISSUE.CLAIMS, detail: 'claim: role must be authenticated role' };
  }
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    return { code: TOKEN_ISSUE.CLAIMS, detail: 'claim: sub' };
  }
  if (!Number.isFinite(claims.exp)) {
    return { code: TOKEN_ISSUE.CLAIMS, detail: 'claim: exp' };
  }
  if (claims.exp <= nowSeconds) {
    return { code: TOKEN_ISSUE.EXPIRED, detail: 'exp is not in the future' };
  }
  // `ref` and `iss` are optional for a token minted by this project's own GoTrue, but must never
  // point at another project.
  if (claims.ref && claims.ref !== projectRef) {
    return { code: TOKEN_ISSUE.PROJECT, detail: 'claim: ref' };
  }
  if (claims.iss && !String(claims.iss).startsWith('https://' + projectRef + '.supabase.co/auth/v1')) {
    return { code: TOKEN_ISSUE.ISSUER, detail: 'claim: iss' };
  }

  return { code: null, detail: 'ok', claims };
}

const ISSUE_MESSAGES = {
  [TOKEN_ISSUE.MISSING]: (detail) => `A dedicated restored-project test-user JWT is required (${detail})`,
  [TOKEN_ISSUE.SEGMENTS]: (detail) => `Malformed test-user JWT: ${TOKEN_ISSUE.SEGMENTS} (${detail})`,
  [TOKEN_ISSUE.ENCODING]: (detail) => `Malformed test-user JWT: ${TOKEN_ISSUE.ENCODING} (${detail})`,
  [TOKEN_ISSUE.JSON]: (detail) => `Malformed test-user JWT: ${TOKEN_ISSUE.JSON} (${detail})`,
  [TOKEN_ISSUE.CLAIMS]: (detail) => `${REQUIRED_CLAIMS_MESSAGE} (${TOKEN_ISSUE.CLAIMS}: ${detail})`,
  [TOKEN_ISSUE.EXPIRED]: (detail) => `${REQUIRED_CLAIMS_MESSAGE} (${TOKEN_ISSUE.EXPIRED}: ${detail})`,
  [TOKEN_ISSUE.PROJECT]: (detail) => `Test-user token references another Supabase project (${TOKEN_ISSUE.PROJECT}: ${detail})`,
  [TOKEN_ISSUE.ISSUER]: (detail) => `Test-user token issuer does not match the restored project (${TOKEN_ISSUE.ISSUER}: ${detail})`,
  [TOKEN_ISSUE.CLOCK]: (detail) => `Test-user token timestamps are inconsistent (${TOKEN_ISSUE.CLOCK}: ${detail})`,
};

function inspectTestToken(token, options) {
  const { code, detail } = classifyTestToken(token, options);
  if (code) throw new Error(ISSUE_MESSAGES[code](detail));
  return true;
}

// ---------------------------------------------------------------------------
// P1: runtime authentication (no stored token)
// ---------------------------------------------------------------------------
const AUTH_TOKEN_URL = 'https://' + PROJECT_REF + '.supabase.co/auth/v1/token?grant_type=password';
const CATALOG_URL = 'https://' + PROJECT_REF + '.supabase.co/rest/v1/scenario_catalog?select=diagnostic_area&limit=1';
const REQUEST_TIMEOUT_MS = 15000;
const CLOCK_SKEW_SECONDS = 60;
const MAX_RESPONSE_BYTES = 100000;

/** Emitted as a GitHub annotation so a green job cannot be mistaken for authenticated evidence. */
const NOT_RUN_WARNING =
  '::warning::NOT RUN: authenticated restored-project access was NOT verified ' +
  '(RESTORED_TEST_USER_EMAIL / RESTORED_TEST_USER_PASSWORD are not configured)';

/** GoTrue error codes safe to print. Anything else stays 'unclassified'. */
const KNOWN_AUTH_ERROR_CODES = new Set([
  'invalid_credentials',
  'email_not_confirmed',
  'user_not_found',
  'invalid_grant',
  'over_request_rate_limit',
  'invalid_api_key',
]);

function classifyAuthError(payload) {
  const raw = payload && typeof payload === 'object' ? payload.error_code || payload.error : null;
  return typeof raw === 'string' && KNOWN_AUTH_ERROR_CODES.has(raw) ? raw : 'unclassified';
}

/**
 * iat/exp consistency, checked after the classifier has already required exp to be in the future.
 * No fixed lifetime cap: a project may configure a longer lifetime, so only internal consistency is
 * enforced. A zero or negative lifetime is a defect.
 */
function checkTokenConsistency(
  claims,
  { nowSeconds = Math.floor(Date.now() / 1000), skewSeconds = CLOCK_SKEW_SECONDS } = {}
) {
  const exp = claims && claims.exp;
  const iat = claims && claims.iat;
  if (iat === undefined) return { code: null, detail: 'ok' };
  if (!Number.isFinite(iat)) return { code: TOKEN_ISSUE.CLAIMS, detail: 'claim: iat' };
  if (iat >= exp) return { code: TOKEN_ISSUE.CLOCK, detail: 'iat is not before exp' };
  if (iat > nowSeconds + skewSeconds) return { code: TOKEN_ISSUE.CLOCK, detail: 'iat is in the future' };
  return { code: null, detail: 'ok' };
}

/**
 * Password grant against the restored project's own GoTrue. Only the access token leaves this
 * function: the response body, refresh token and user object are dropped in memory, never logged,
 * never returned.
 */
async function requestAccessToken({
  fetchImpl = fetch,
  email,
  password,
  anonKey,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  let response;
  try {
    response = await fetchImpl(AUTH_TOKEN_URL, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { apikey: anonKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    const name = error && error.name;
    return { code: name === 'TimeoutError' || name === 'AbortError' ? 'auth-http-timeout' : 'auth-network-error' };
  }
  if (!response || typeof response.status !== 'number') return { code: 'auth-unusable-response' };
  if (!response.ok) return { code: 'auth-http-' + response.status };

  let payload;
  try {
    payload = await response.json();
  } catch {
    return { code: 'auth-body-not-json' };
  }
  if (!payload || typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
    return { code: 'auth-missing-access-token' };
  }
  const provider = classifyAuthError(payload);
  if (provider !== 'unclassified') return { code: 'auth-provider-' + provider };
  return { accessToken: payload.access_token };
}
/** Read-only catalog GET. Reports status and allowlisted codes only, never the body. */
async function fetchCatalog({ fetchImpl = fetch, anonKey, accessToken, keyType, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  let response;
  try {
    response = await fetchImpl(CATALOG_URL, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: buildRequestHeaders(anonKey, accessToken),
    });
  } catch (error) {
    const name = error && error.name;
    return { code: name === 'TimeoutError' || name === 'AbortError' ? 'catalog-timeout' : 'catalog-network-error' };
  }
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) return { code: 'catalog-response-too-large' };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (response.status !== 200) {
    const detail = describeFailure(
      {
        status: response.status,
        errorCode: classifyBodyCode(parsed),
        gatewayCode: classifyGatewayCode(response.headers.get('sb-error-code')),
      },
      keyType
    );
    return { code: 'catalog-http-' + response.status, detail };
  }
  if (!Array.isArray(parsed)) return { code: 'catalog-not-array' };
  return { rows: parsed.length };
}

/**
 * Full run. Injectable env/fetch/clock/logger so the whole matrix is asserted offline with no
 * secret, no network and no project access.
 */
async function runSmoke({
  env = process.env,
  fetchImpl = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
  log = console.log,
} = {}) {
  if (env.EXPECTED_SUPABASE_REF !== PROJECT_REF) throw new Error('Restored project reference mismatch');

  const anonKey = env.RESTORED_SUPABASE_ANON_KEY;
  let keyType;
  try {
    keyType = classifyCredential(anonKey);
  } catch {
    throw new Error('Restored-project API key rejected: ' + (anonKey ? 'invalid-api-key' : 'missing-api-key'));
  }

  const email = env.RESTORED_TEST_USER_EMAIL;
  const password = env.RESTORED_TEST_USER_PASSWORD;
  if (!email || !password) {
    // No fallback: a stored static token is never consulted, even when one is configured.
    log(NOT_RUN_WARNING);
    log(
      'NOT RUN: authenticated access was not verified. Provide RESTORED_TEST_USER_EMAIL and ' +
        'RESTORED_TEST_USER_PASSWORD for a dedicated disposable user in the restored project.'
    );
    return { status: 'not-run' };
  }

  const signIn = await requestAccessToken({ fetchImpl, email, password, anonKey });
  if (signIn.code) throw new Error('Restored-project sign-in failed: ' + signIn.code);

  const verdict = classifyTestToken(signIn.accessToken, { nowSeconds });
  if (verdict.code) throw new Error('Access token rejected: ' + verdict.code + ' (' + verdict.detail + ')');

  const consistency = checkTokenConsistency(verdict.claims, { nowSeconds });
  if (consistency.code) {
    throw new Error('Access token rejected: ' + consistency.code + ' (' + consistency.detail + ')');
  }

  const catalog = await fetchCatalog({ fetchImpl, anonKey, accessToken: signIn.accessToken, keyType });
  if (catalog.code) {
    throw new Error(
      'Authenticated catalog read failed: ' + catalog.code + (catalog.detail ? ' (' + catalog.detail + ')' : '')
    );
  }

  log('PASS restored-project authenticated catalog read (no writes performed)');
  log('NOTE tenant-isolation and unauthorized-write behavioral evidence remain outstanding');
  return { status: 'pass' };
}

async function main() {
  await runSmoke();
}

if (require.main === module) main().catch((e) => {
  console.error('FAIL restored-project authenticated smoke:', e.message);
  process.exitCode = 1;
});
module.exports = {
  inspectTestToken,
  classifyTestToken,
  checkTokenConsistency,
  requestAccessToken,
  fetchCatalog,
  runSmoke,
  classifyAuthError,
  TOKEN_ISSUE,
  NOT_RUN_WARNING,
  AUTH_TOKEN_URL,
  CATALOG_URL,
};
