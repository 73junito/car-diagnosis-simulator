// Supabase token verification helper (hardened)
// verifyToken(token, clientFactory?) ->
// - success: { userId, role, source: 'supabase' }
// - no-op (demo fallback): null
// - denied (supabase mode): { denied: true, reason, source: 'supabase' }

async function verifyToken(token, clientFactory) {
  if (!token) return null;
  const accessToken = token.replace(/^Bearer\s+/i, '').trim();

  const mode = (process.env.TORQUEMIND_AUTH_MODE || 'demo').toLowerCase(); // 'demo' or 'supabase'
  const SUPABASE_URL = process.env.SUPABASE_URL || null;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;

  const useClientFactory = typeof clientFactory === 'function';
  const canUseSupabase = useClientFactory || (SUPABASE_URL && SUPABASE_ANON_KEY);

  // In strict "supabase" mode, missing envs with an Authorization header must deny access (fail-closed)
  if (mode === 'supabase' && !canUseSupabase) {
    return { denied: true, reason: 'missing_env', source: 'supabase' };
  }

  // If we can't use Supabase (no envs and no factory) and we're in demo mode, return null
  // so callers can fallback to header-based demo behavior.
  if (!canUseSupabase) return null;

  try {
    let client = null;
    if (useClientFactory) {
      client = clientFactory(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      const { createClient } = require('@supabase/supabase-js');
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // Prefer auth.getUser({ access_token })
    if (client && client.auth && typeof client.auth.getUser === 'function') {
      const resp = await client.auth.getUser({ access_token: accessToken });
      const user = resp && resp.data && resp.data.user;
      if (!user) {
        if (mode === 'supabase') return { denied: true, reason: 'invalid_token', source: 'supabase' };
        return null;
      }
      const role = (user.user_metadata && user.user_metadata.role) || (user.app_metadata && user.app_metadata.role) || 'anonymous';
      return { userId: user.id, role, source: 'supabase' };
    }

    // Some mocks may expose getUser directly
    if (client && typeof client.getUser === 'function') {
      const resp = await client.getUser(accessToken);
      const user = resp && resp.data && resp.data.user;
      if (!user) {
        if (mode === 'supabase') return { denied: true, reason: 'invalid_token', source: 'supabase' };
        return null;
      }
      const role = (user.user_metadata && user.user_metadata.role) || (user.app_metadata && user.app_metadata.role) || 'anonymous';
      return { userId: user.id, role, source: 'supabase' };
    }

    if (mode === 'supabase') return { denied: true, reason: 'verify_unavailable', source: 'supabase' };
    return null;
  } catch (e) {
    if (mode === 'supabase') return { denied: true, reason: 'verify_error', source: 'supabase' };
    return null;
  }
}

module.exports = { verifyToken };
