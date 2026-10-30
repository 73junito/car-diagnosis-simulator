'use strict';
const assert = require('node:assert/strict');
const { inspectTestToken, classifyTestToken, TOKEN_ISSUE } = require('../scripts/smoke-restored-supabase-authenticated.cjs');

// Synthetic tokens only. The header is built at runtime so this file contains no literal
// `eyJ...` sequence that a secret scanner would have to reason about.
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const PROJECT = 'nbgvllelsfhnmuwuqlkw';

function jwt(claims) {
  return [HEADER, Buffer.from(JSON.stringify(claims)).toString('base64url'), 'signature'].join('.');
}
function raw(parts) {
  return parts.join('.');
}

const NOW = 1_700_000_000;
const valid = () => ({
  role: 'authenticated',
  sub: 'test-user',
  exp: NOW + 3600,
  iss: 'https://' + PROJECT + '.supabase.co/auth/v1',
});

describe('Restored authenticated smoke token preflight (not signature verification)', () => {
  test('accepts structurally eligible test-user token', () => {
    assert.equal(inspectTestToken(jwt(valid()), { nowSeconds: NOW }), true);
    assert.equal(classifyTestToken(jwt(valid()), { nowSeconds: NOW }).code, null);
  });

  test('rejects anon role', () => {
    assert.throws(() => inspectTestToken(jwt({ ...valid(), role: 'anon' }), { nowSeconds: NOW }), /authenticated role/);
  });

  test('rejects expired JWT', () => {
    assert.throws(() => inspectTestToken(jwt({ ...valid(), exp: 1 }), { nowSeconds: NOW }), /unexpired/);
  });

  test('rejects another project issuer', () => {
    assert.throws(
      () => inspectTestToken(jwt({ ...valid(), iss: 'https://different.supabase.co/auth/v1' }), { nowSeconds: NOW }),
      /issuer/
    );
  });

  test('rejects missing token and malformed claims', () => {
    assert.throws(() => inspectTestToken(''), /required/);
    assert.throws(() => inspectTestToken('a.@@@.c'), /Malformed/);
  });
});


describe('Restored authenticated smoke token preflight classification', () => {
  const code = (token, options = { nowSeconds: NOW }) => classifyTestToken(token, options).code;

  test('missing token is classified separately from a malformed one', () => {
    assert.equal(code(undefined), TOKEN_ISSUE.MISSING);
    assert.equal(code(''), TOKEN_ISSUE.MISSING);
    assert.equal(code(null), TOKEN_ISSUE.MISSING);
  });

  test('invalid segment count is reported with the observed count', () => {
    assert.equal(code('onlyonesegment'), TOKEN_ISSUE.SEGMENTS);
    assert.equal(code(raw([HEADER, 'payload'])), TOKEN_ISSUE.SEGMENTS);
    assert.equal(code(raw([HEADER, 'payload', 'sig', 'extra'])), TOKEN_ISSUE.SEGMENTS);
    assert.match(classifyTestToken(raw([HEADER, 'payload', 'sig', 'extra'])).detail, /4 segment/);
  });

  test('malformed payload encoding is distinguished from invalid JSON', () => {
    // Characters outside the base64url alphabet, and a length that cannot be valid base64.
    assert.equal(code(raw([HEADER, '@@@', 'sig'])), TOKEN_ISSUE.ENCODING);
    assert.equal(code(raw([HEADER, 'a+b/c=', 'sig'])), TOKEN_ISSUE.ENCODING);
    assert.equal(code(raw([HEADER, 'abcde', 'sig'])), TOKEN_ISSUE.ENCODING);
  });

  test('payload that decodes but is not JSON is classified as invalid JSON', () => {
    const notJson = Buffer.from('this is not json').toString('base64url');
    assert.equal(code(raw([HEADER, notJson, 'sig'])), TOKEN_ISSUE.JSON);
  });

  test('payload that parses but is not an object is an invalid claim', () => {
    assert.equal(code(jwt(['array', 'not', 'object'])), TOKEN_ISSUE.CLAIMS);
    assert.match(classifyTestToken(jwt(['x']), { nowSeconds: NOW }).detail, /not an object/);
  });

  test('each missing or wrong required claim is named', () => {
    const withoutSub = { ...valid() };
    delete withoutSub.sub;
    const withoutExp = { ...valid() };
    delete withoutExp.exp;
    assert.match(classifyTestToken(jwt(withoutSub), { nowSeconds: NOW }).detail, /claim: sub/);
    assert.match(classifyTestToken(jwt(withoutExp), { nowSeconds: NOW }).detail, /claim: exp/);
    assert.match(classifyTestToken(jwt({ ...valid(), exp: 'soon' }), { nowSeconds: NOW }).detail, /claim: exp/);
    assert.match(classifyTestToken(jwt({ ...valid(), role: 'anon' }), { nowSeconds: NOW }).detail, /claim: role/);
  });

  test('expired token is its own class, evaluated against the supplied clock', () => {
    const token = jwt({ ...valid(), exp: NOW - 1 });
    assert.equal(code(token), TOKEN_ISSUE.EXPIRED);
    // The same token is acceptable one second earlier in time: no lifetime cap is hard-coded.
    assert.equal(classifyTestToken(token, { nowSeconds: NOW - 2 }).code, null);
  });

  test('wrong project reference and wrong issuer are separate classes', () => {
    assert.equal(code(jwt({ ...valid(), ref: 'otherprojectref' })), TOKEN_ISSUE.PROJECT);
    assert.equal(code(jwt({ ...valid(), iss: 'https://otherprojectref.supabase.co/auth/v1' })), TOKEN_ISSUE.ISSUER);
  });

  test('a token without the optional ref/iss claims is still acceptable', () => {
    const minimal = { role: 'authenticated', sub: 'test-user', exp: NOW + 60 };
    assert.equal(classifyTestToken(jwt(minimal), { nowSeconds: NOW }).code, null);
  });
});


describe('Restored authenticated smoke token preflight fail-closed contract', () => {
  test('every present-but-invalid credential is rejected, never skipped', () => {
    const invalid = [
      'a.@@@.c',
      raw([HEADER, 'payload']),
      raw([HEADER, Buffer.from('not json').toString('base64url'), 'sig']),
      jwt({ ...valid(), role: 'anon' }),
      jwt({ ...valid(), exp: 1 }),
      jwt({ ...valid(), ref: 'otherprojectref' }),
      jwt({ ...valid(), iss: 'https://elsewhere.example/auth/v1' }),
    ];
    for (const token of invalid) {
      assert.throws(() => inspectTestToken(token, { nowSeconds: NOW }), Error, 'expected a rejection');
    }
  });

  test('rejection messages never contain token material', () => {
    const canary = 'CANARYCATALOGTOKEN';
    const payload = Buffer.from(
      JSON.stringify({ role: 'anon', sub: 'x', exp: 1, marker: canary })
    ).toString('base64url');
    const signature = 'signaturecanaryvalue';
    const token = raw([HEADER, payload, signature]);

    const { code: issue, detail } = classifyTestToken(token, { nowSeconds: NOW });
    let message = '';
    try {
      inspectTestToken(token, { nowSeconds: NOW });
    } catch (error) {
      message = error.message;
    }

    assert.equal(issue, TOKEN_ISSUE.CLAIMS);
    assert.equal(message.length > 0, true);
    for (const forbidden of [payload, canary, signature, HEADER]) {
      assert.equal(message.includes(forbidden), false, 'message must not contain token bytes');
      assert.equal(detail.includes(forbidden), false, 'detail must not contain token bytes');
    }
  });
});

