'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  inspectTestToken,
  classifyTestToken,
  checkTokenConsistency,
  requestAccessToken,
  fetchCatalog,
  runSmoke,
  TOKEN_ISSUE,
  NOT_RUN_WARNING,
  AUTH_TOKEN_URL,
  CATALOG_URL,
} = require('../scripts/smoke-restored-supabase-authenticated.cjs');

// Synthetic tokens only. The header is built at runtime so this file contains no literal
// `eyJ...` sequence that a secret scanner would have to reason about.
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const PROJECT = 'nbgvllelsfhnmuwuqlkw';
const ANON_KEY = 'sb_publishable_synthetic_test_key';
const EMAIL = 'disposable.user@example.invalid';
const PASSWORD = 'synthetic-password-not-a-credential';

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


// ---------------------------------------------------------------------------
// P1: runtime password-grant authentication (offline, stub fetch)
// ---------------------------------------------------------------------------
const NOW_S = 1_700_000_000;

function tokenWith(claims) {
  return [HEADER, Buffer.from(JSON.stringify(claims)).toString('base64url'), 'signature'].join('.');
}
const freshToken = (overrides = {}) =>
  tokenWith({ role: 'authenticated', sub: 'disposable-user', exp: NOW_S + 3600, iat: NOW_S, ...overrides });

function httpResponse({ status = 200, json, text }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (json === undefined) throw new SyntaxError('Unexpected token');
      return json;
    },
    text: async () => (text !== undefined ? text : JSON.stringify(json)),
    headers: { get: () => null },
  };
}

/** Stub transport: records every call so "no GET happened" can be asserted. */
function stubTransport({ signIn, catalog }) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === AUTH_TOKEN_URL) {
      if (signIn instanceof Error) throw signIn;
      return signIn;
    }
    if (url === CATALOG_URL) {
      if (catalog instanceof Error) throw catalog;
      return catalog;
    }
    throw new Error('unexpected URL in stub transport');
  };
  return {
    fetchImpl,
    calls,
    authCalls: () => calls.filter((call) => call.url === AUTH_TOKEN_URL).length,
    catalogCalls: () => calls.filter((call) => call.url === CATALOG_URL).length,
  };
}

function baseEnv(overrides = {}) {
  return {
    EXPECTED_SUPABASE_REF: PROJECT,
    RESTORED_SUPABASE_ANON_KEY: ANON_KEY,
    RESTORED_TEST_USER_EMAIL: EMAIL,
    RESTORED_TEST_USER_PASSWORD: PASSWORD,
    ...overrides,
  };
}

async function run({ signIn, catalog, env = baseEnv() } = {}) {
  const transport = stubTransport({ signIn, catalog });
  const lines = [];
  let error = null;
  let result = null;
  try {
    result = await runSmoke({ env, fetchImpl: transport.fetchImpl, nowSeconds: NOW_S, log: (line) => lines.push(line) });
  } catch (thrown) {
    error = thrown;
  }
  return { transport, lines, error, result, output: lines.join('\n') + (error ? error.message : '') };
}

describe('P1 runtime authentication — happy path', () => {
  test('signs in, validates the token, then performs exactly one read-only GET', async () => {
    const { transport, result, error } = await run({
      signIn: httpResponse({ json: { access_token: freshToken(), refresh_token: 'ignored', user: { id: 'x' } } }),
      catalog: httpResponse({ json: [{ diagnostic_area: 'electrical' }] }),
    });
    assert.equal(error, null);
    assert.deepEqual(result, { status: 'pass' });
    assert.equal(transport.authCalls(), 1);
    assert.equal(transport.catalogCalls(), 1);
    const get = transport.calls.find((call) => call.url === CATALOG_URL);
    assert.match(get.options.headers.Authorization, /^Bearer /);
    assert.equal(get.options.method, 'GET');
    const post = transport.calls.find((call) => call.url === AUTH_TOKEN_URL);
    assert.equal(post.options.method, 'POST');
    assert.equal(post.options.body, JSON.stringify({ email: EMAIL, password: PASSWORD }));
  });
});


describe('P1 runtime authentication — sign-in failures fail closed before any read', () => {
  const cases = [
    ['bad credentials', httpResponse({ status: 400, json: { error: 'invalid_credentials' } }), 'auth-http-400'],
    ['rejected api key', httpResponse({ status: 401, json: { error: 'invalid_api_key' } }), 'auth-http-401'],
    ['rate limited', httpResponse({ status: 429, json: {} }), 'auth-http-429'],
    ['upstream error', httpResponse({ status: 500, json: {} }), 'auth-http-500'],
    ['non-JSON body', httpResponse({ status: 200, json: undefined }), 'auth-body-not-json'],
    ['empty object', httpResponse({ json: {} }), 'auth-missing-access-token'],
    ['non-string token', httpResponse({ json: { access_token: 42 } }), 'auth-missing-access-token'],
    ['empty token', httpResponse({ json: { access_token: '' } }), 'auth-missing-access-token'],
    ['network failure', Object.assign(new Error('boom'), { name: 'TypeError' }), 'auth-network-error'],
    ['timeout', Object.assign(new Error('aborted'), { name: 'TimeoutError' }), 'auth-http-timeout'],
  ];

  test.each(cases)('%s fails closed with %s', async (_label, signIn, expected) => {
    const { transport, error } = await run({ signIn, catalog: httpResponse({ json: [] }) });
    assert.ok(error, 'expected a failure');
    assert.match(error.message, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(transport.catalogCalls(), 0, 'no catalog read may follow a failed sign-in');
  });

  test('an allowlisted GoTrue error code is reported instead of the raw error', async () => {
    const { error } = await run({
      signIn: httpResponse({ json: { access_token: freshToken(), error: 'invalid_credentials' } }),
      catalog: httpResponse({ json: [] }),
    });
    assert.ok(error);
    assert.match(error.message, /auth-provider-invalid_credentials/);
  });

  test('an unknown provider error string is never printed', async () => {
    const { error } = await run({
      signIn: httpResponse({ json: { error: 'SECRET-LEAK-CANARY' } }),
      catalog: httpResponse({ json: [] }),
    });
    assert.ok(error);
    assert.match(error.message, /auth-missing-access-token/);
    assert.equal(error.message.includes('SECRET-LEAK-CANARY'), false);
  });
});

describe('P1 runtime authentication — returned token validation', () => {
  const rejected = [
    ['anon role', freshToken({ role: 'anon' }), /invalid-claims/],
    ['expired', freshToken({ exp: NOW_S - 1 }), /expired-token/],
    ['iat after exp', freshToken({ iat: NOW_S + 100, exp: NOW_S + 50 }), /clock-inconsistent/],
    ['zero lifetime', freshToken({ iat: NOW_S + 10, exp: NOW_S + 10 }), /clock-inconsistent/],
    ['iat in the future', freshToken({ iat: NOW_S + 3600, exp: NOW_S + 7200 }), /clock-inconsistent/],
    ['other project ref', freshToken({ ref: 'otherprojectref' }), /project-mismatch/],
    ['other issuer', freshToken({ iss: 'https://otherprojectref.supabase.co/auth/v1' }), /issuer-mismatch/],
    ['malformed token', 'not-a-token', /invalid-segment-count/],
  ];

  test.each(rejected)('a returned token with %s is refused before the read', async (_label, token, pattern) => {
    const { transport, error } = await run({
      signIn: httpResponse({ json: { access_token: token } }),
      catalog: httpResponse({ json: [] }),
    });
    assert.ok(error, 'expected a rejection');
    assert.match(error.message, pattern);
    assert.equal(transport.catalogCalls(), 0);
  });

  test('a longer configured lifetime is accepted (no hard-coded one-hour cap)', async () => {
    const { result, error } = await run({
      signIn: httpResponse({ json: { access_token: freshToken({ iat: NOW_S, exp: NOW_S + 24 * 3600 }) } }),
      catalog: httpResponse({ json: [] }),
    });
    assert.equal(error, null);
    assert.deepEqual(result, { status: 'pass' });
  });

  test('iat/exp consistency is evaluated against the supplied clock, not wall time', () => {
    const claims = { exp: NOW_S + 60, iat: NOW_S };
    assert.equal(checkTokenConsistency(claims, { nowSeconds: NOW_S }).code, null);
    // iat more than the 60s skew in the future is inconsistent.
    assert.equal(
      checkTokenConsistency({ exp: NOW_S + 600, iat: NOW_S + 120 }, { nowSeconds: NOW_S }).code,
      TOKEN_ISSUE.CLOCK
    );
    // iat no later than exp is required.
    assert.equal(
      checkTokenConsistency({ exp: NOW_S + 60, iat: NOW_S + 60 }, { nowSeconds: NOW_S }).code,
      TOKEN_ISSUE.CLOCK
    );
    // iat is optional: a token without it is still acceptable.
    assert.equal(checkTokenConsistency({ exp: NOW_S + 60 }, { nowSeconds: NOW_S }).code, null);
  });
});


describe('P1 runtime authentication — read stage and output discipline', () => {
  test('a 401 and a 403 at the read stage are reported distinctly from auth failures', async () => {
    for (const status of [401, 403]) {
      const { error } = await run({
        signIn: httpResponse({ json: { access_token: freshToken() } }),
        catalog: httpResponse({ status, json: { code: status === 401 ? 'PGRST301' : '42501' } }),
      });
      assert.ok(error);
      assert.match(error.message, new RegExp('catalog-http-' + status));
      assert.equal(error.message.includes('auth-'), false, 'must not be confused with a sign-in failure');
    }
  });

  test('a 200 response that is not an array is refused', async () => {
    const { error } = await run({
      signIn: httpResponse({ json: { access_token: freshToken() } }),
      catalog: httpResponse({ json: { code: 'PGRST301' } }),
    });
    assert.ok(error);
    assert.match(error.message, /catalog-not-array/);
  });

  test('a catalog network error is refused', async () => {
    const { error } = await run({
      signIn: httpResponse({ json: { access_token: freshToken() } }),
      catalog: Object.assign(new Error('reset'), { name: 'TypeError' }),
    });
    assert.ok(error);
    assert.match(error.message, /catalog-network-error/);
  });

  test('absent credentials produce NOT RUN plus a warning annotation, never a pass', async () => {
    const { result, output, transport } = await run({
      signIn: httpResponse({ json: {} }),
      catalog: httpResponse({ json: [] }),
      env: baseEnv({ RESTORED_TEST_USER_EMAIL: undefined, RESTORED_TEST_USER_PASSWORD: undefined }),
    });
    assert.deepEqual(result, { status: 'not-run' });
    assert.match(output, /^::warning::NOT RUN:/m);
    assert.match(output, /NOT RUN: authenticated access was not verified/);
    assert.equal(transport.calls.length, 0, 'no network call may be attempted without credentials');
    assert.equal(/^PASS /m.test(output), false, 'a NOT RUN must never print a PASS line');
  });

  test('a stored JWT secret is never used as a fallback', async () => {
    const { result, output, transport } = await run({
      signIn: httpResponse({ json: {} }),
      catalog: httpResponse({ json: [] }),
      env: baseEnv({
        RESTORED_TEST_USER_EMAIL: undefined,
        RESTORED_TEST_USER_PASSWORD: undefined,
        RESTORED_TEST_USER_JWT: freshToken(),
      }),
    });
    assert.deepEqual(result, { status: 'not-run' });
    assert.match(output, /^::warning::NOT RUN:/m);
    assert.equal(transport.calls.length, 0);
  });

  test('the script source contains no reference to the retired JWT secret', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'smoke-restored-supabase-authenticated.cjs'), 'utf8');
    assert.equal(source.includes('RESTORED_TEST_USER_JWT'), false);
    assert.equal(source.includes('GITHUB_OUTPUT'), false);
    assert.equal(source.includes('writeFileSync'), false);
  });

  test('no credential, token or response body reaches the log', async () => {
    const token = freshToken({ marker: 'TOKEN-LEAK-CANARY' });
    const { output } = await run({
      signIn: httpResponse({
        json: { access_token: token, refresh_token: 'REFRESH-LEAK-CANARY', user: { id: 'USER-CANARY' } },
      }),
      catalog: httpResponse({ json: [{ diagnostic_area: 'BODY-LEAK-CANARY' }] }),
    });
    for (const forbidden of [token, 'TOKEN-LEAK-CANARY', 'REFRESH-LEAK-CANARY', 'USER-CANARY', 'BODY-LEAK-CANARY', EMAIL, PASSWORD]) {
      assert.equal(output.includes(forbidden), false, 'output must not contain credential material');
    }
    assert.match(output, /PASS restored-project authenticated catalog read/);
  });

  test('a failing run never echoes the credentials either', async () => {
    const { output } = await run({
      signIn: httpResponse({ status: 401, json: { error: 'invalid_api_key' } }),
      catalog: httpResponse({ json: [] }),
    });
    assert.equal(output.includes(EMAIL), false);
    assert.equal(output.includes(PASSWORD), false);
  });

  test('the retired JWT variable is absent from the workflow, which now wires email and password', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', '.github', 'workflows', 'lmf-restored-supabase-access.yml'),
      'utf8'
    );
    assert.equal(workflow.includes('RESTORED_TEST_USER_JWT'), false);
    assert.match(workflow, /RESTORED_TEST_USER_EMAIL: \$\{\{ secrets\.RESTORED_TEST_USER_EMAIL \}\}/);
    assert.match(workflow, /RESTORED_TEST_USER_PASSWORD: \$\{\{ secrets\.RESTORED_TEST_USER_PASSWORD \}\}/);
    assert.match(workflow, /EXPECTED_SUPABASE_REF: \$\{\{ vars\.EXPECTED_SUPABASE_REF \}\}/);
    assert.match(workflow, /RESTORED_SUPABASE_ANON_KEY: \$\{\{ secrets\.ANON_KEY \}\}/);
  });
});

