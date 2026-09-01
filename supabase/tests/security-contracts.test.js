'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

process.env.SUPABASE_URL = 'https://unit-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-placeholder';

let activeClient;
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@supabase/supabase-js') {
    return { createClient: () => activeClient };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const analytics = require('../functions/get_daily_analytics');
const history = require('../functions/get_session_history');
const telemetry = require('../functions/insert_telemetry_batch');

const owner = '39c622f0-19ef-40f8-a692-460c5928129f';
const other = '959ca5d0-9c08-4088-b9a0-e9f7ca91219b';

function responseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    end(body) { this.body = JSON.parse(body); },
  };
}

function clientFor(user, behavior = {}) {
  return {
    auth: {
      async getUser() {
        return user ? { data: { user }, error: null } : { data: {}, error: new Error('invalid') };
      },
    },
    from(table) {
      if (behavior.from) return behavior.from(table);
      throw new Error(`Unexpected database call: ${table}`);
    },
  };
}

test('every privileged handler rejects missing bearer tokens', async () => {
  activeClient = clientFor({ id: owner });
  for (const [handler, method] of [[analytics, 'GET'], [history, 'GET'], [telemetry, 'POST']]) {
    const response = responseRecorder();
    await handler({ method, headers: {}, query: {}, body: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers['Cache-Control'], 'no-store');
  }
});

test('expired or invalid bearer tokens are rejected', async () => {
  activeClient = clientFor(null);
  const response = responseRecorder();
  await history({ method: 'GET', headers: { authorization: 'Bearer expired' }, query: {} }, response);
  assert.equal(response.statusCode, 401);
});

test('editable user_metadata cannot grant analytics privileges', async () => {
  activeClient = clientFor({ id: owner, user_metadata: { role: 'admin' }, app_metadata: {} });
  const response = responseRecorder();
  await analytics({ method: 'GET', headers: { authorization: 'Bearer valid' }, query: {} }, response);
  assert.equal(response.statusCode, 403);
});

test('session history always filters by verified user ownership', async () => {
  const filters = [];
  const query = {
    select() { return this; },
    eq(name, value) { filters.push([name, value]); return this; },
    order() { return this; },
    async limit() { return { data: [], error: null }; },
  };
  activeClient = clientFor({ id: owner }, { from: () => query });
  const response = responseRecorder();
  await history({
    method: 'GET', headers: { authorization: 'Bearer valid' }, query: { session_id: 'session-1' },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(filters, [['session_id', 'session-1'], ['user_id', owner]]);
});

test('cross-user telemetry is rejected without database writes', async () => {
  activeClient = clientFor({ id: owner });
  const response = responseRecorder();
  await telemetry({
    method: 'POST', headers: { authorization: 'Bearer valid' },
    body: { events: [{ type: 'answer', user_id: other, payload: {} }] },
  }, response);
  assert.equal(response.statusCode, 403);
});

test('telemetry writes overwrite caller ownership with verified identity', async () => {
  const writes = [];
  activeClient = clientFor({ id: owner }, {
    from(table) {
      return { async insert(rows) { writes.push({ table, rows }); return { error: null }; } };
    },
  });
  const response = responseRecorder();
  await telemetry({
    method: 'POST', headers: { authorization: 'Bearer valid' },
    body: { events: [{ type: 'answer', session_id: 's1', step: 0, payload: { confidence: 0.8 } }] },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.inserted, 1);
  assert.equal(writes[0].rows[0].user_id, owner);
  assert.equal(writes[1].rows[0].user_id, owner);
});

test('oversized telemetry batches fail closed', async () => {
  activeClient = clientFor({ id: owner });
  const response = responseRecorder();
  await telemetry({
    method: 'POST', headers: { authorization: 'Bearer valid' },
    body: { events: Array.from({ length: 101 }, () => ({ type: 'event', payload: {} })) },
  }, response);
  assert.equal(response.statusCode, 413);
});

test('trusted app_metadata authorizes analytics and invalid dates fail closed', async () => {
  activeClient = clientFor({ id: owner, app_metadata: { role: 'admin' } });
  const response = responseRecorder();
  await analytics({
    method: 'GET', headers: { authorization: 'Bearer valid' }, query: { date: 'not-a-date' },
  }, response);
  assert.equal(response.statusCode, 400);
});
