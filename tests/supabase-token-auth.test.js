const assert = require('assert');
const { resolveUserRole } = require('../api/auth/role');

// Mock client factory that simulates Supabase client behavior
function makeMockClientFactory(user) {
  return () => ({
    auth: {
      getUser: async ({ access_token }) => ({ data: { user } })
    },
    getUser: async (token) => ({ data: { user } })
  });
}

async function run(){
  // Case: Supabase env set and valid token -> role from user metadata
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon';

  const user = { id: 'u-1', user_metadata: { role: 'instructor' }, app_metadata: {} };
  const req = { headers: { authorization: 'Bearer tok' } };

  const info = await resolveUserRole(req, makeMockClientFactory(user));
  assert.strictEqual(info.role, 'instructor');
  assert.strictEqual(info.userId, 'u-1');
  assert.strictEqual(info.source, 'supabase');

  // Case: Supabase env missing -> fallback to header
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY;
  const req2 = { headers: { authorization: 'Bearer tok', 'x-torquemind-role': 'student' } };
  const info2 = await resolveUserRole(req2);
  assert.strictEqual(info2.role, 'student');
  assert.strictEqual(info2.source, 'header+token');

  console.log('Supabase token auth scaffold tests passed.');
}

if (require.main === module) run().catch(err=>{ console.error(err); process.exit(1); });

module.exports = run;
