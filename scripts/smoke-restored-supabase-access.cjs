'use strict';

// Read-only restored-project smoke tests. Never use service-role credentials here.
const assert = require('node:assert/strict');
const PROJECT_REF = 'nbgvllelsfhnmuwuqlkw';
const url = new URL('https://' + PROJECT_REF + '.supabase.co');

// Machine-readable error codes that are safe to print. Response bodies and
// credentials are never logged; anything outside these sets stays
// 'unclassified' so no secret material can reach the CI log.
const KNOWN_BODY_ERROR_CODES = new Set([
  'PGRST301', 'PGRST302', '42501', 'invalid_jwt', 'invalid_api_key', 'bad_jwt', 'JWTExpired',
]);
// Gateway-level credential rejections are reported in the `sb-error-code`
// response header instead of the JSON body, so they are classified separately.
const KNOWN_GATEWAY_ERROR_CODES = new Set([
  'UNAUTHORIZED_INVALID_API_KEY', 'UNAUTHORIZED_UNREGISTERED_API_KEY',
]);

function classifyCredential(anonKey) {
  if (!anonKey) throw new Error('Missing restored-project public API key');
  if (anonKey.startsWith('sb_publishable_')) return 'publishable';
  if (anonKey.split('.').length === 3) return 'legacy-jwt';
  throw new Error('Expected publishable key or legacy anon JWT');
}

// A publishable key is opaque rather than a JWT, so it travels in the apikey
// header only. Sending one as a Bearer token makes PostgREST reject the
// request (PGRST301) instead of resolving the anonymous role.
function buildRequestHeaders(anonKey, token) {
  const headers = { apikey: anonKey, Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return headers;
}

function classifyBodyCode(rows) {
  if (rows && !Array.isArray(rows) && typeof rows.code === 'string' && KNOWN_BODY_ERROR_CODES.has(rows.code)) {
    return rows.code;
  }
  return 'unclassified';
}

function classifyGatewayCode(headerValue) {
  if (typeof headerValue === 'string' && KNOWN_GATEWAY_ERROR_CODES.has(headerValue)) return headerValue;
  return 'unclassified';
}

function describeFailure(result, keyType) {
  const parts = [`HTTP ${result.status}`, `code ${result.errorCode}`];
  if (result.gatewayCode && result.gatewayCode !== 'unclassified') parts.push(`gateway ${result.gatewayCode}`);
  parts.push(`key type ${keyType}`);
  return parts.join('; ');
}

async function main() {
  const expected = process.env.EXPECTED_SUPABASE_REF;
  const anonKey = process.env.RESTORED_SUPABASE_ANON_KEY;
  if (expected !== PROJECT_REF) throw new Error('Restored project reference mismatch');
  const keyType = classifyCredential(anonKey);
  const publishable = keyType === 'publishable';
  const request = async (path, token) => {
    const response = await fetch(new URL(path, url), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: buildRequestHeaders(anonKey, token),
    });
    const body = await response.text();
    if (body.length > 100000) throw new Error('Unexpectedly large API response');
    let rows; try { rows = JSON.parse(body); } catch { rows = null; }
    // Report only allowlisted machine error codes; never print API responses or credentials.
    return {
      status: response.status,
      rows,
      errorCode: classifyBodyCode(rows),
      gatewayCode: classifyGatewayCode(response.headers.get('sb-error-code')),
    };
  };
  const questions = await request('/rest/v1/scenario_questions?select=diagnostic_area&limit=1', publishable ? null : anonKey);
  // Match verified staging/restored grants: anon has no SELECT privilege on scenario tables.
  // RLS read policies do not confer table privileges; never grant access merely to pass smoke.
  assert.ok([401, 403].includes(questions.status) && questions.errorCode === '42501',
    `Question access contract changed (${describeFailure(questions, keyType)})`);
  const catalog = await request('/rest/v1/scenario_catalog?select=diagnostic_area&limit=1', publishable ? null : anonKey);
  // Catalog also denies anon at the table-privilege boundary.
  assert.ok([401, 403].includes(catalog.status) && catalog.errorCode === '42501',
    `Catalog access contract changed (${describeFailure(catalog, keyType)})`);
  const bad = await request('/rest/v1/scenario_catalog?select=diagnostic_area&limit=1', 'intentionally.invalid.token');
  assert.ok([401,403].includes(bad.status), 'Malformed token was accepted');
  console.log('PASS restored project anonymous access-denial and malformed-token checks');
  console.log('NOTE positive authenticated user access and write-denial tests remain outstanding');
}

if (require.main === module) {
  main().catch(e => {console.error('FAIL restored-project access smoke:',e.message);process.exitCode=1;});
}

module.exports = {
  PROJECT_REF,
  KNOWN_BODY_ERROR_CODES,
  KNOWN_GATEWAY_ERROR_CODES,
  classifyCredential,
  buildRequestHeaders,
  classifyBodyCode,
  classifyGatewayCode,
  describeFailure,
};
