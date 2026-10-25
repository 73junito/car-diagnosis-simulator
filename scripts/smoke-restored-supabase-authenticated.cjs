'use strict';
const assert = require('node:assert/strict');
const { PROJECT_REF, classifyCredential, buildRequestHeaders, classifyBodyCode, classifyGatewayCode, describeFailure } = require('./smoke-restored-supabase-access.cjs');

function inspectTestToken(token) {
  if (!token || token.split('.').length !== 3) throw new Error('A dedicated restored-project test-user JWT is required');
  // The header and claims are untrusted until Supabase validates the signature.
  let claims;
  try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); }
  catch { throw new Error('Malformed test-user JWT claims'); }
  if (claims.role !== 'authenticated' || !claims.sub || !Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000))
    throw new Error('Test-user JWT must have authenticated role, subject, and unexpired timestamp');
  if (claims.ref && claims.ref !== PROJECT_REF) throw new Error('Test-user token references another Supabase project');
  if (claims.iss && !claims.iss.startsWith('https://' + PROJECT_REF + '.supabase.co/auth/v1'))
    throw new Error('Test-user token issuer does not match the restored project');
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
module.exports = { inspectTestToken };
