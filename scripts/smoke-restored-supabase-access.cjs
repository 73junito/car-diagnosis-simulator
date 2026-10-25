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
  return { status: response.status, rows };
};
(async () => {
  const questions = await request('/rest/v1/scenario_questions?select=diagnostic_area&limit=1', publishable ? null : anonKey);
  assert.equal(questions.status, 200, 'Anonymous question read failed');
  assert.ok(Array.isArray(questions.rows), 'Question result was not an array');
  const catalog = await request('/rest/v1/scenario_catalog?select=diagnostic_area&limit=1', anonKey);
  // Catalog is protected by authenticated-only SELECT RLS. RLS may return [] or 403.
  if (catalog.status === 200) assert.deepEqual(catalog.rows, [], 'Anonymous user saw protected catalog data');
  else assert.ok([401, 403].includes(catalog.status), 'Unexpected anonymous catalog response');
  const bad = await request('/rest/v1/scenario_catalog?select=diagnostic_area&limit=1', 'intentionally.invalid.token');
  assert.ok([401,403].includes(bad.status), 'Malformed token was accepted');
  console.log('PASS restored project read-only anon access and malformed-token checks');
  console.log('NOTE positive authenticated user access and write-denial tests remain outstanding');
})().catch(e => {console.error('FAIL restored-project access smoke:',e.message);process.exitCode=1;});
