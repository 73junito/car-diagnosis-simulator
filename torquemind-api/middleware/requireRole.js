module.exports = function requireRole(role){
  return function(req, res, next){
    // If server not configured with Supabase, allow (local fallback)
    if (!req.app.get('supabaseConfigured')) return next();

    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    // role check: user.role should exist from `users` table
    if (user.role !== role) return res.status(403).json({ error: 'Insufficient role' });
    return next();
  };
};
