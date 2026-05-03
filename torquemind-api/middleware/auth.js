const { createClient } = require('@supabase/supabase-js');

module.exports = function createAuthMiddleware(supabase){
  return async function authMiddleware(req, res, next){
    // Quick request-level trace to confirm middleware invocation in CI
    try {
      console.log('Auth middleware entry', { method: req.method, path: req.path, hasAuth: !!(req.headers && (req.headers.authorization || req.headers.Authorization)) });
    } catch (e) {
      // ignore logging failures
    }
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
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data || !data.user) {
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
        const url = process.env.SUPABASE_URL;
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
          .select('role, id, email, name')
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

        console.log('Auth resolved user', {
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
