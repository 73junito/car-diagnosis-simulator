'use strict';
const assert = require('node:assert/strict');
const {
  runReport,
  classifySettings,
  boolOrNull,
  RECORD_PREFIX,
  RECORD_FIELDS,
  SETTINGS_URL,
} = require('../scripts/report-restored-auth-config.cjs');

const PROJECT = 'nbgvllelsfhnmuwuqlkw';
const ANON_KEY = 'sb_publishable_synthetic_report_key';
// Canaries that must never appear in any output.
const KEY_CANARY = 'KEY-CANARY-DO-NOT-EMIT';
const BODY_CANARY = 'BODY-CANARY-config-value';
const HEADER_CANARY = 'HEADER-CANARY-bearer';

function settingsResponse({ status = 200, json, text } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (text !== undefined ? text : JSON.stringify(json)),
    json: async () => json,
    headers: { get: () => HEADER_CANARY },
  };
}

function stubFetch(response) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (response instanceof Error) throw response;
    return typeof response === 'function' ? response() : response;
  };
  return { fetchImpl, calls };
}

const baseEnv = (overrides = {}) => ({
  EXPECTED_SUPABASE_REF: PROJECT,
  RESTORED_SUPABASE_ANON_KEY: ANON_KEY,
  ...overrides,
});

async function report({ response, env = baseEnv() } = {}) {
  const transport = stubFetch(response ?? settingsResponse({ json: {} }));
  const lines = [];
  const result = await runReport({ env, fetchImpl: transport.fetchImpl, log: (line) => lines.push(line) });
  const output = lines.join('\n');
  const record = parseRecord(output);
  return { transport, lines, output, result, record };
}

function parseRecord(output) {
  const line = output.split('\n').find((entry) => entry.startsWith(RECORD_PREFIX));
  return line ? JSON.parse(line.slice(RECORD_PREFIX.length)) : null;
}

const SUPPORTED = {
  external: { email: true, phone: false },
  disable_signup: false,
  mailer_autoconfirm: false,
};

describe('Auth settings report — classification', () => {
  test('supported configuration: email provider on, signup open, confirmation required', async () => {
    const { result, record } = await report({ response: settingsResponse({ json: SUPPORTED }) });
    assert.equal(result.status, 'ok');
    assert.equal(record.probe, 'ok');
    assert.equal(record.httpStatus, 200);
    assert.equal(record.emailProvider, true);
    assert.equal(record.disableSignup, false);
    assert.equal(record.mailerAutoconfirm, false);
    assert.equal(record.passwordGrant, 'supported');
    assert.equal(record.signup, 'open');
    assert.equal(record.emailConfirmation, 'required');
    assert.equal(record.reason, 'ok');
  });

  test('auto-confirmed signup is reported distinctly from required confirmation', async () => {
    const { record } = await report({
      response: settingsResponse({ json: { ...SUPPORTED, mailer_autoconfirm: true } }),
    });
    assert.equal(record.emailConfirmation, 'auto-confirmed');
  });

  test('signup disabled is reported as restricted, not as a missing credential', async () => {
    const { record } = await report({
      response: settingsResponse({ json: { ...SUPPORTED, disable_signup: true } }),
    });
    assert.equal(record.signup, 'restricted');
    assert.equal(record.passwordGrant, 'supported');
  });

  test('email provider disabled is reported as disabled, explicitly and separately', async () => {
    const { record, result } = await report({
      response: settingsResponse({ json: { ...SUPPORTED, external: { email: false, phone: true } } }),
    });
    assert.equal(result.status, 'ok');
    assert.equal(record.emailProvider, false);
    assert.equal(record.passwordGrant, 'disabled');
  });

  test('missing external block is uncertain with a named field, never disabled', async () => {
    const { record } = await report({
      response: settingsResponse({ json: { disable_signup: false, mailer_autoconfirm: false } }),
    });
    assert.equal(record.emailProvider, null);
    assert.equal(record.passwordGrant, 'uncertain');
    assert.match(record.reason, /missing-or-invalid:external\.email/);
  });

  test('non-boolean field values are uncertain with every bad field named', async () => {
    const { record } = await report({
      response: settingsResponse({
        json: { external: { email: 'yes' }, disable_signup: 'no', mailer_autoconfirm: 0 },
      }),
    });
    assert.equal(record.passwordGrant, 'uncertain');
    assert.equal(record.signup, 'uncertain');
    assert.equal(record.emailConfirmation, 'uncertain');
    assert.match(record.reason, /external\.email/);
    assert.match(record.reason, /disable_signup/);
    assert.match(record.reason, /mailer_autoconfirm/);
  });

  test('a JSON array body is uncertain, not disabled', async () => {
    const { record } = await report({ response: settingsResponse({ json: [] }) });
    assert.equal(record.passwordGrant, 'uncertain');
    assert.equal(record.probe, 'ok');
  });

  test('boolOrNull keeps unknown values unknown', () => {
    assert.equal(boolOrNull(true), true);
    assert.equal(boolOrNull(false), false);
    assert.equal(boolOrNull('true'), null);
    assert.equal(boolOrNull(1), null);
    assert.equal(boolOrNull(undefined), null);
  });

  test('classifySettings is pure and independent of transport', () => {
    assert.equal(classifySettings(SUPPORTED).passwordGrant, 'supported');
    assert.equal(classifySettings(null).passwordGrant, 'uncertain');
  });
});


describe('Auth settings report — probe failures are classified, never guessed', () => {
  const cases = [
    ['HTTP 401', settingsResponse({ status: 401, json: { message: BODY_CANARY } }), 'settings-http-401', 'failed'],
    ['HTTP 500', settingsResponse({ status: 500, text: BODY_CANARY }), 'settings-http-500', 'failed'],
    ['non-JSON body', settingsResponse({ status: 200, text: '<html>' + BODY_CANARY + '</html>' }), 'settings-body-not-json', 'failed'],
    ['network error', Object.assign(new Error('boom'), { name: 'TypeError' }), 'settings-network-error', 'failed'],
    ['timeout', Object.assign(new Error('aborted'), { name: 'TimeoutError' }), 'settings-http-timeout', 'failed'],
  ];

  test.each(cases)('%s is classified %s and marked uncertain', async (_label, response, reason, status) => {
    const { result, record } = await report({ response });
    assert.equal(result.status, status);
    assert.equal(record.probe, 'failed');
    assert.equal(record.reason, reason);
    // A failed probe must never be reported as a disabled feature.
    assert.equal(record.passwordGrant, 'uncertain');
    assert.equal(record.emailProvider, null);
  });

  test('an oversized body is rejected without parsing', async () => {
    const { record } = await report({ response: settingsResponse({ status: 200, text: 'x'.repeat(100001) }) });
    assert.equal(record.reason, 'settings-response-too-large');
  });
});

describe('Auth settings report — binding, single request, and redaction', () => {
  test('issues exactly one GET, carries the key only in the apikey header, and sends no bearer token', async () => {
    const { transport } = await report({ response: settingsResponse({ json: SUPPORTED }) });
    assert.equal(transport.calls.length, 1);
    const [call] = transport.calls;
    assert.equal(call.url, SETTINGS_URL);
    assert.equal(call.options.method, 'GET');
    assert.equal(call.options.headers.apikey, ANON_KEY);
    assert.equal('Authorization' in call.options.headers, false, 'must not authenticate as a user');
    assert.equal(call.options.headers.accept ?? call.options.headers.Accept, 'application/json');
    assert.equal(call.options.redirect, 'error');
  });

  test('a mismatched project reference refuses before any request', async () => {
    const { transport, result, record } = await report({
      response: settingsResponse({ json: SUPPORTED }),
      env: baseEnv({ EXPECTED_SUPABASE_REF: 'jchfruprqpeypdttvlam' }),
    });
    assert.equal(result.status, 'refused');
    assert.equal(record.reason, 'project-mismatch');
    assert.equal(transport.calls.length, 0);
  });

  test('a missing api key refuses before any request', async () => {
    const { transport, result, record } = await report({
      response: settingsResponse({ json: SUPPORTED }),
      env: baseEnv({ RESTORED_SUPABASE_ANON_KEY: undefined }),
    });
    assert.equal(result.status, 'refused');
    assert.equal(record.reason, 'missing-api-key');
    assert.equal(transport.calls.length, 0);
  });

  test('no key, header or body value reaches the output on success', async () => {
    const { output } = await report({
      response: settingsResponse({
        json: { ...SUPPORTED, marker: BODY_CANARY, external: { email: true, phone: false, note: BODY_CANARY } },
      }),
      env: baseEnv({ RESTORED_SUPABASE_ANON_KEY: KEY_CANARY }),
    });
    for (const forbidden of [KEY_CANARY, BODY_CANARY, HEADER_CANARY]) {
      assert.equal(output.includes(forbidden), false, 'output must not contain ' + forbidden);
    }
  });

  test('no key, header or body value reaches the output on failure', async () => {
    const { output } = await report({
      response: settingsResponse({ status: 403, text: BODY_CANARY }),
      env: baseEnv({ RESTORED_SUPABASE_ANON_KEY: KEY_CANARY }),
    });
    for (const forbidden of [KEY_CANARY, BODY_CANARY, HEADER_CANARY]) {
      assert.equal(output.includes(forbidden), false, 'output must not contain ' + forbidden);
    }
  });

  test('exactly one record is emitted and its key set is the allowlist', async () => {
    const { output, record } = await report({ response: settingsResponse({ json: SUPPORTED }) });
    assert.equal(output.split('\n').filter((line) => line.startsWith(RECORD_PREFIX)).length, 1);
    assert.deepEqual(Object.keys(record), [...RECORD_FIELDS]);
    assert.equal(record.ref, PROJECT);
  });
});

