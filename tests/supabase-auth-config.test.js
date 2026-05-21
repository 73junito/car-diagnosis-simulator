const request = require('supertest');
const assert = require('assert');

// Mocked Supabase client for tests
const mockCreateClient = (url, key) => ({
  auth: {
    getUser: async ({ access_token }) => {
      if (access_token === 'instructor-token') return { data: { user: { id: 'u-instructor', user_metadata: { role: 'instructor' } } } };
      if (access_token === 'student-token') return { data: { user: { id: 'u-student', user_metadata: { role: 'student' } } } };
      return { data: { user: null } };
    }
  }
});

try {
  const modPath = require.resolve('@supabase/supabase-js');
  require.cache[modPath] = { id: modPath, filename: modPath, loaded: true, exports: { createClient: mockCreateClient } };
} catch (e) {
  // continue — tests still valid with demo fallback
}

const { app } = require('../torquemind-api/index');
const { getRecentEvents } = require('../api/telemetry/events');

async function run() {
  // Case: strict supabase mode but envs missing -> deny (fail-closed)
  process.env.TORQUEMIND_AUTH_MODE = 'supabase';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  let recent = getRecentEvents();
  await request(app)
    .get('/dashboard/live-session')
    .set('Authorization', 'Bearer instructor-token')
    .expect(401);
  recent = getRecentEvents();
  let last = recent[recent.length - 1];
  assert.ok(last && last.type === 'access_attempt');
  assert.strictEqual(last.role, 'anonymous');
  assert.strictEqual(last.source, 'supabase');
  assert.strictEqual(last.allowed, false);

  // Case: supabase mode with envs present, invalid token -> deny
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon';

  await request(app)
    .get('/dashboard/live-session')
    .set('Authorization', 'Bearer invalid-token')
    .expect(401);
  recent = getRecentEvents();
  last = recent[recent.length - 1];
  assert.ok(last && last.type === 'access_attempt');
  assert.strictEqual(last.role, 'anonymous');
  assert.strictEqual(last.source, 'supabase');

  // Case: supabase mode with valid instructor token -> allow
  await request(app)
    .get('/dashboard/live-session')
    .set('Authorization', 'Bearer instructor-token')
    .expect(200);
  recent = getRecentEvents();
  last = recent[recent.length - 1];
  assert.ok(last && last.type === 'access_attempt');
  assert.strictEqual(last.userId, 'u-instructor');
  assert.strictEqual(last.role, 'instructor');
  assert.strictEqual(last.source, 'supabase');
  assert.strictEqual(last.allowed, true);

  // Case: demo mode header fallback allowed
  process.env.TORQUEMIND_AUTH_MODE = 'demo';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  await request(app)
    .get('/dashboard/live-session')
    .set('x-torquemind-role', 'instructor')
    .expect(200);
  recent = getRecentEvents();
  last = recent[recent.length - 1];
  assert.ok(last && last.type === 'access_attempt');
  assert.strictEqual(last.role, 'instructor');
  assert.strictEqual(last.source, 'header');

  console.log('Supabase auth config tests passed.');
}

if (require.main === module) run().catch(err => { console.error(err); process.exit(1); });

module.exports = run;
