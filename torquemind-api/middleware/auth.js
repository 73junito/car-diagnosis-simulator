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
        const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
        const url = process.env.SUPABASE_URL;
        let prof = null;
        if (url && anon) {
          const authedClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
          const { data: profData } = await authedClient.from('profiles').select('role, id, email, name').eq('id', user.id).maybeSingle();
          if (profData && Object.keys(profData).length) prof = profData;
          else {
            const { data: u } = await authedClient.from('users').select('*').eq('id', user.id).maybeSingle();
            if (u && Object.keys(u).length) prof = u;
          }
        } else {
          // Fallback to existing client if envs aren't available
          const { data: profData } = await supabase.from('profiles').select('role, id, email, name').eq('id', user.id).maybeSingle();
          if (profData && Object.keys(profData).length) prof = profData;
          else {
            const { data: u } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
            if (u && Object.keys(u).length) prof = u;
          }
        }
        if (prof) attached = { ...attached, ...prof };
      } catch (fetchErr) {
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
