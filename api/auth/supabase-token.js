// Supabase token verification helper (scaffold)
// verifyToken(token, clientFactory?) -> { userId, role, source } | null

async function verifyToken(token, clientFactory) {
  if (!token) return null;
  const accessToken = token.replace(/^Bearer\s+/i, '').trim();

  const SUPABASE_URL = process.env.SUPABASE_URL || null;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;

  // If clientFactory provided (for tests), use it; otherwise require real client if env present
  const useClientFactory = typeof clientFactory === 'function';
  if (!useClientFactory && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) return null;

  try {
    let client = null;
    if (useClientFactory) {
      client = clientFactory(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      const { createClient } = require('@supabase/supabase-js');
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // Prefer auth.getUser(access_token: ...) which returns { data: { user } }
    if (client && client.auth && typeof client.auth.getUser === 'function') {
      const resp = await client.auth.getUser({ access_token: accessToken });
      const user = resp && resp.data && resp.data.user;
      if (!user) return null;
      const role = (user.user_metadata && (user.user_metadata.role || user.user_metadata.role)) || (user.app_metadata && user.app_metadata.role) || 'anonymous';
      return { userId: user.id, role, source: 'supabase' };
    }

    // some client mocks may expose getUser directly
    if (client && typeof client.getUser === 'function') {
      const resp = await client.getUser(accessToken);
      const user = resp && resp.data && resp.data.user;
      if (!user) return null;
      const role = (user.user_metadata && user.user_metadata.role) || (user.app_metadata && user.app_metadata.role) || 'anonymous';
      return { userId: user.id, role, source: 'supabase' };
    }

    return null;
  } catch (e) {
    // swallow errors and return null so callers can fallback
    return null;
  }
}

module.exports = { verifyToken };
