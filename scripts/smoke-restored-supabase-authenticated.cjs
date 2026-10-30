'use strict';
const assert = require('node:assert/strict');
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

  return { code: null, detail: 'ok' };
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
};

function inspectTestToken(token, options) {
  const { code, detail } = classifyTestToken(token, options);
  if (code) throw new Error(ISSUE_MESSAGES[code](detail));
  return true;
}

async function main() {
  if (process.env.EXPECTED_SUPABASE_REF !== PROJECT_REF) throw new Error('Restored project reference mismatch');
  const key = process.env.RESTORED_SUPABASE_ANON_KEY;
  classifyCredential(key);
  const token = process.env.RESTORED_TEST_USER_JWT;
  if (!token) {
    console.log('NOT RUN: restored-project authenticated-user smoke needs RESTORED_TEST_USER_JWT from a dedicated disposable test user');
    return;
  }
  inspectTestToken(token);
  const response = await fetch('https://' + PROJECT_REF + '.supabase.co/rest/v1/scenario_catalog?select=diagnostic_area&limit=1', {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: buildRequestHeaders(key, token),
  });
  const body = await response.text();
  if (body.length > 100000) throw new Error('Unexpectedly large REST response');
  let parsed; try { parsed = JSON.parse(body); } catch { parsed = null; }
  const result = {
    status: response.status,
    errorCode: classifyBodyCode(parsed),
    gatewayCode: classifyGatewayCode(response.headers.get('sb-error-code')),
  };
  assert.equal(result.status, 200, 'Authenticated catalog SELECT failed (' + describeFailure(result, classifyCredential(key)) + ')');
  assert.ok(Array.isArray(parsed), 'Authenticated catalog response must be an array');
  console.log('PASS restored-project authenticated catalog read (no writes performed)');
  console.log('NOTE tenant-isolation and unauthorized-write behavioral evidence remain outstanding');
}
if (require.main === module) main().catch(e => {
  console.error('FAIL restored-project authenticated smoke:', e.message);
  process.exitCode = 1;
});
module.exports = { inspectTestToken, classifyTestToken, TOKEN_ISSUE };
