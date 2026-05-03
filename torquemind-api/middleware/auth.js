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
      // Prefer loading role from a dedicated `profiles` table (recommended)
      // Fallback to `users` table if `profiles` doesn't exist or has no role field.
      let attached = { id: user.id, email: user.email };
      try {
        const { data: prof, error: profErr } = await supabase.from('profiles').select('role, id, email, name').eq('id', user.id).maybeSingle();
        if (prof && Object.keys(prof).length) {
          attached = { ...attached, ...prof };
        } else {
          // fallback to older `users` table used in some deployments
          const { data: u, error: uErr } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
          if (u && Object.keys(u).length) attached = { ...attached, ...u };
        }
      } catch (fetchErr) {
        // If anything goes wrong querying profiles/users, attach basic user info and continue.
        console.warn('Profile lookup failed; continuing with basic user info', fetchErr && fetchErr.message);
      }
      req.user = attached;
      // Safe debug log: don't print tokens or sensitive data.
      console.log('Auth resolved user', {
        id: req.user && req.user.id,
        email: req.user && req.user.email,
        role: req.user && req.user.role,
      });
      return next();
    } catch (e){
      console.error('Auth middleware error', e);
      return res.status(500).json({ error: 'Auth verification failed' });
    }
  };
};
