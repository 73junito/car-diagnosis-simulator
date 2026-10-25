'use strict';
const assert = require('node:assert/strict');
const { inspectTestToken } = require('../scripts/smoke-restored-supabase-authenticated.cjs');
function jwt(claims) {
  return ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'signature'].join('.');
}
const valid = () => ({
  role: 'authenticated', sub: 'test-user', exp: Math.floor(Date.now()/1000)+3600,
  iss: 'https://nbgvllelsfhnmuwuqlkw.supabase.co/auth/v1',
});
describe('Restored authenticated smoke token preflight (not signature verification)', () => {
  test('accepts structurally eligible test-user token', () => assert.equal(inspectTestToken(jwt(valid())), true));
  test('rejects anon role', () => assert.throws(() => inspectTestToken(jwt({...valid(),role:'anon'})), /authenticated role/));
  test('rejects expired JWT', () => assert.throws(() => inspectTestToken(jwt({...valid(),exp:1})), /unexpired/));
  test('rejects another project issuer', () => assert.throws(() => inspectTestToken(jwt({...valid(),iss:'https://different.supabase.co/auth/v1'})), /issuer/));
  test('rejects missing token and malformed claims', () => {
    assert.throws(() => inspectTestToken(''), /required/);
    assert.throws(() => inspectTestToken('a.@@@.c'), /Malformed/);
  });
});
