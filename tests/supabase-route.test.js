const request = require('supertest');
const assert = require('assert');

// Prepare a mock Supabase client before loading the app so role resolution
// will use the mocked client when env vars are present.
const mockCreateClient = () => ({
  auth: {
    getUser: async ({ access_token }) => {
      if (access_token === 'instructor-token') return { data: { user: { id: 'u-instructor', user_metadata: { role: 'instructor' } } } };
      if (access_token === 'student-token') return { data: { user: { id: 'u-student', user_metadata: { role: 'student' } } } };
      return { data: { user: null } };
    }
  }
});

// Inject mock module for '@supabase/supabase-js' so code that calls createClient uses our mock
try {
  const modPath = require.resolve('@supabase/supabase-js');
  require.cache[modPath] = { id: modPath, filename: modPath, loaded: true, exports: { createClient: mockCreateClient } };
} catch (e) {
  // If resolution fails, tests will still proceed using fallback header logic
}

// Enable Supabase env so role resolver attempts verification
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon';

const { app } = require('../torquemind-api/index');
const { getRecentEvents } = require('../api/telemetry/events');

async function run() {
  // clear recent events
  let recent = getRecentEvents();

  // instructor token -> 200
  await request(app)
    .get('/dashboard/live-session')
    .set('Authorization', 'Bearer instructor-token')
    .expect(200);
  recent = getRecentEvents();
  let last = recent[recent.length - 1];
  assert.ok(last && last.type === 'access_attempt');
  assert.strictEqual(last.userId, 'u-instructor');
  assert.strictEqual(last.role, 'instructor');
  assert.strictEqual(last.source, 'supabase');
  assert.strictEqual(last.allowed, true);
  assert.strictEqual(last.scope, 'live-session');

  // student token -> 401
  await request(app)
    .get('/dashboard/live-session')
    .set('Authorization', 'Bearer student-token')
    .expect(401);
  recent = getRecentEvents();
  last = recent[recent.length - 1];
  assert.ok(last && last.type === 'access_attempt');
  assert.strictEqual(last.userId, 'u-student');
  assert.strictEqual(last.role, 'student');
  assert.strictEqual(last.source, 'supabase');
  assert.strictEqual(last.allowed, false);
  assert.strictEqual(last.scope, 'live-session');

  // invalid token -> fallback deny (no header role); expect anonymous
  await request(app)
    .get('/dashboard/live-session')
    .set('Authorization', 'Bearer invalid-token')
    .expect(401);
  recent = getRecentEvents();
  last = recent[recent.length - 1];
  assert.ok(last && last.type === 'access_attempt');
  assert.strictEqual(last.role, 'anonymous');
  assert.strictEqual(last.allowed, false);
  assert.strictEqual(last.scope, 'live-session');

  console.log('Supabase route integration tests passed.');
}

if (require.main === module) run().catch(err => { console.error(err); process.exit(1); });

module.exports = run;
