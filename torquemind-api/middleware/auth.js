module.exports = function createAuthMiddleware(supabase){
  return async function authMiddleware(req, res, next){
    // If Supabase not configured, allow through (localStorage fallback/dev)
    if (!supabase){ req.user = null; return next(); }

    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth || !auth.startsWith('Bearer ')){
      req.user = null;
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const token = auth.replace(/^Bearer\s+/i, '');
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data || !data.user) return res.status(401).json({ error: 'Invalid or expired token' });
      const user = data.user;
      // load profile from users table (if present)
      const { data: profile, error: pErr } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      req.user = profile || { id: user.id, email: user.email };
      return next();
    } catch (e){
      console.error('Auth middleware error', e);
      return res.status(500).json({ error: 'Auth verification failed' });
    }
  };
};
