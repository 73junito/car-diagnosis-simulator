'use strict';

// Read-only restored-project smoke tests. Never use service-role credentials here.
const assert = require('node:assert/strict');
const PROJECT_REF = 'nbgvllelsfhnmuwuqlkw';
const url = new URL('https://' + PROJECT_REF + '.supabase.co');
const expected = process.env.EXPECTED_SUPABASE_REF;
const anonKey = process.env.RESTORED_SUPABASE_ANON_KEY;
if (expected !== PROJECT_REF) throw new Error('Restored project reference mismatch');
if (!anonKey) throw new Error('Missing restored-project public API key');
const publishable = anonKey.startsWith('sb_publishable_');
if (!publishable && anonKey.split('.').length !== 3) throw new Error('Expected publishable key or legacy anon JWT');
const request = async (path, token) => {
  const response = await fetch(new URL(path, url), {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { apikey: anonKey, ...(token ? { Authorization: 'Bearer ' + token } : {}), Accept: 'application/json' },
  });
  const body = await response.text();
  if (body.length > 100000) throw new Error('Unexpectedly large API response');
  let rows; try { rows = JSON.parse(body); } catch { rows = null; }
  // Report only allowlisted machine error codes; never print API responses or credentials.
  const knownCodes = new Set(['PGRST301', 'PGRST302', '42501', 'invalid_jwt', 'invalid_api_key', 'bad_jwt', 'JWTExpired']);
  const errorCode = rows && !Array.isArray(rows) && typeof rows.code === 'string' && knownCodes.has(rows.code) ? rows.code : 'unclassified';
  return { status: response.status, rows, errorCode };
};
(async () => {
  const questions = await request('/rest/v1/scenario_questions?select=diagnostic_area&limit=1', publishable ? null : anonKey);
  // Match verified staging/restored grants: anon has no SELECT privilege on scenario tables.
  // RLS read policies do not confer table privileges; never grant access merely to pass smoke.
  assert.ok([401, 403].includes(questions.status) && questions.errorCode === '42501',
    `Question access contract changed (HTTP ${questions.status}; code ${questions.errorCode}; key type ${publishable ? 'publishable' : 'legacy-jwt'})`);
  const catalog = await request('/rest/v1/scenario_catalog?select=diagnostic_area&limit=1', publishable ? null : anonKey);
  // Catalog also denies anon at the table-privilege boundary.
  assert.ok([401, 403].includes(catalog.status) && catalog.errorCode === '42501',
    `Catalog access contract changed (HTTP ${catalog.status}; code ${catalog.errorCode})`);
  const bad = await request('/rest/v1/scenario_catalog?select=diagnostic_area&limit=1', 'intentionally.invalid.token');
  assert.ok([401,403].includes(bad.status), 'Malformed token was accepted');
  console.log('PASS restored project anonymous access-denial and malformed-token checks');
  console.log('NOTE positive authenticated user access and write-denial tests remain outstanding');
})().catch(e => {console.error('FAIL restored-project access smoke:',e.message);process.exitCode=1;});
