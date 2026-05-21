// Role resolution: tries Supabase token verification when env vars are set
const { verifyToken } = require('./supabase-token');

async function resolveUserRole(req, clientFactory) {
  let role = 'anonymous';
  let userId = null;
  let source = 'none';

  if (req && req.headers) {
    // If Authorization header present and Supabase env configured, attempt token verification
    if (req.headers.authorization) {
      const tokenInfo = await verifyToken(req.headers.authorization, clientFactory);
      // If verifier returns an explicit denial (object with `denied: true`), treat as authoritative
      if (tokenInfo && tokenInfo.denied) {
        return { role: 'anonymous', userId: null, source: tokenInfo.source || 'supabase' };
      }
      if (tokenInfo) {
        return { role: tokenInfo.role || 'anonymous', userId: tokenInfo.userId || null, source: tokenInfo.source || 'supabase' };
      }
      // token verification failed or not configured; fall through to header-based (demo) behavior
    }

    if (req.headers['x-torquemind-role']) {
      role = req.headers['x-torquemind-role'];
      source = 'header';
    }

    if (req.headers.authorization && source === 'header') {
      source = 'header+token';
    } else if (req.headers.authorization) {
      source = 'token';
    }
  }

  return { role, userId, source };
}

module.exports = { resolveUserRole };
