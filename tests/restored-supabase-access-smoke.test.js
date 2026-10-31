'use strict';

const assert = require('node:assert/strict');
const {
  PROJECT_REF,
  KNOWN_BODY_ERROR_CODES,
  KNOWN_GATEWAY_ERROR_CODES,
  classifyCredential,
  buildRequestHeaders,
  classifyBodyCode,
  classifyGatewayCode,
  describeFailure,
} = require('../scripts/smoke-restored-supabase-access.cjs');

describe('Restored-project access smoke contract', () => {
  test('binds the smoke run to the isolated restored project', () => {
    assert.equal(PROJECT_REF, 'nbgvllelsfhnmuwuqlkw');
  });

  test('accepts publishable keys and legacy anon JWTs', () => {
    assert.equal(classifyCredential('sb_publishable_abc123'), 'publishable');
    assert.equal(classifyCredential('aaa.bbb.ccc'), 'legacy-jwt');
  });

  test('rejects a missing or malformed credential', () => {
    assert.throws(() => classifyCredential(''), /Missing restored-project public API key/);
    assert.throws(() => classifyCredential('not-a-key'), /Expected publishable key or legacy anon JWT/);
  });

  test('sends a publishable key as apikey only, never as a bearer token', () => {
    const headers = buildRequestHeaders('sb_publishable_abc123', null);
    assert.equal(headers.apikey, 'sb_publishable_abc123');
    assert.equal('Authorization' in headers, false);
  });

  test('sends a legacy anon JWT as apikey and bearer token', () => {
    const headers = buildRequestHeaders('aaa.bbb.ccc', 'aaa.bbb.ccc');
    assert.equal(headers.apikey, 'aaa.bbb.ccc');
    assert.equal(headers.Authorization, 'Bearer aaa.bbb.ccc');
    assert.equal(headers.Accept, 'application/json');
  });

  test('reports only allowlisted body error codes', () => {
    assert.equal(classifyBodyCode({ code: '42501' }), '42501');
    assert.equal(classifyBodyCode({ code: 'PGRST301' }), 'PGRST301');
    assert.equal(classifyBodyCode({ code: 'secrety' }), 'unclassified');
    assert.equal(classifyBodyCode([{ code: '42501' }]), 'unclassified');
    assert.equal(classifyBodyCode(null), 'unclassified');
    for (const code of KNOWN_BODY_ERROR_CODES) {
      assert.equal(classifyBodyCode({ code }), code);
    }
  });

  test('reports only allowlisted gateway error codes', () => {
    assert.equal(classifyGatewayCode('UNAUTHORIZED_INVALID_API_KEY'), 'UNAUTHORIZED_INVALID_API_KEY');
    assert.equal(classifyGatewayCode('UNAUTHORIZED_UNREGISTERED_API_KEY'), 'UNAUTHORIZED_UNREGISTERED_API_KEY');
    assert.equal(classifyGatewayCode('UNAUTHORIZED_SOMETHING_ELSE'), 'unclassified');
    assert.equal(classifyGatewayCode(null), 'unclassified');
    for (const code of KNOWN_GATEWAY_ERROR_CODES) {
      assert.equal(classifyGatewayCode(code), code);
    }
  });

  test('distinguishes a gateway credential rejection from a privilege denial', () => {
    const denied = describeFailure(
      { status: 401, errorCode: '42501', gatewayCode: 'unclassified' },
      'publishable'
    );
    assert.match(denied, /HTTP 401/);
    assert.match(denied, /code 42501/);
    assert.equal(/gateway /.test(denied), false);

    const rejected = describeFailure(
      { status: 401, errorCode: 'unclassified', gatewayCode: 'UNAUTHORIZED_INVALID_API_KEY' },
      'publishable'
    );
    assert.match(rejected, /gateway UNAUTHORIZED_INVALID_API_KEY/);
    assert.match(rejected, /key type publishable/);
  });

  test('never echoes credential material into a failure description', () => {
    const secret = 'sb_publishable_do_not_log_this_value';
    const described = describeFailure(
      { status: 401, errorCode: '42501', gatewayCode: 'unclassified', secret },
      'publishable'
    );
    assert.equal(described.includes(secret), false);
  });
});
