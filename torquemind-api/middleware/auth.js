const { createClient } = require('@supabase/supabase-js');

module.exports = function createAuthMiddleware(supabase){
  return async function authMiddleware(req, res, next){
    const debugAuth = process.env.DEBUG_AUTH === 'true';
    const verificationDiagnostics = process.env.AUTH_VERIFY_DIAGNOSTICS === 'true';
    // Quick request-level trace to confirm middleware invocation in CI (guarded)
    try {
      if (debugAuth) console.log('Auth middleware entry', { method: req.method, path: req.path, hasAuth: !!(req.headers && (req.headers.authorization || req.headers.Authorization)) });
    } catch (e) { void e; }
    // If Supabase not configured, allow through (localStorage fallback/dev)
    if (!supabase){ req.user = null; return next(); }
    const auth = req.headers.authorization || req.headers.Authorization;
    // If no Authorization header provided, treat request as unauthenticated
    // and allow it through so public assets and health checks are accessible.
    if (!auth || !auth.startsWith('Bearer ')){
      req.user = null;
      return next();
    }

    const token = auth.replace(/^Bearer\s+/i, '');
    try {
      let { data, error } = await supabase.auth.getUser(token);
      // The SDK can return AuthSessionMissingError in stateless API processes.
      // In that specific case, verify the supplied bearer token with GoTrue's
      // /user endpoint. Never trust decoded JWT claims or bypass verification.
      if (error && (error.name === 'AuthSessionMissingError' || error.message === 'Auth session missing!')) {
        if (verificationDiagnostics) console.log('Auth verification fallback', { path: req.path, reason: 'session-missing' });
        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_ANON_KEY;
        if (url && anon) {
          const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
            headers: { apikey: anon, Authorization: `Bearer ${token}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          });
          if (verificationDiagnostics) console.log('Auth verifier response', { path: req.path, status: response.status, ok: response.ok });
          if (response.ok) {
            const verified = await response.json();
            const verifiedUser = verified && (verified.user || verified);
            if (verifiedUser && typeof verifiedUser.id === 'string' && verifiedUser.id) {
              data = { user: verifiedUser };
              error = null;
            }
          }
        }
      }
      if (verificationDiagnostics) console.log('Auth verification outcome', { path: req.path, verified: !!(data && data.user && !error), errorType: error ? error.name : null });
      if (error || !data || !data.user) {
        console.warn('Auth failed: invalid/expired token', error && error.message);
        req.user = null;
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      const user = data.user;
      // Prefer loading role from a dedicated `profiles` table (recommended).
      // Because projects often enable RLS, run the profiles query as the
      // authenticated user by creating a temporary client with the
      // user's access token so auth.uid() policies work correctly.
      let attached = { id: user.id, email: user.email };
      try {
        // create an authed client using the user's bearer token and the anon key
        const authedSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        });

        const { data: prof, error: profErr } = await authedSupabase
          .from('profiles')
          .select('role, id, email')
          .eq('id', user.id)
          .maybeSingle();

        if (prof && Object.keys(prof).length) {
          attached = { ...attached, ...prof };
        } else {
          // fallback to users table as a last resort
          const { data: u, error: uErr } = await authedSupabase.from('users').select('*').eq('id', user.id).maybeSingle();
          if (u && Object.keys(u).length) attached = { ...attached, ...u };
          if (!prof && uErr) console.warn('User lookup error', uErr.message || uErr);
        }

        if (debugAuth) console.log('Auth resolved user', {
          id: attached.id,
          email: attached.email,
          role: attached.role,
          profileError: profErr && profErr.message ? profErr.message : null,
        });
      } catch (fetchErr) {
        console.warn('Profile lookup failed; continuing with basic user info', fetchErr && fetchErr.message);
      }
      req.user = attached;
      return next();
    } catch (e){
      console.error('Auth middleware error', e);
      return res.status(500).json({ error: 'Auth verification failed' });
    }
  };
};
