module.exports = function requireRole(role){
  return function(req, res, next){
    // If server not configured with Supabase, allow (local fallback)
    if (!req.app.get('supabaseConfigured')) return next();
    const user = req.user;
    try {
      console.log('RequireRole check', { required: role, user: user && { id: user.id, role: user.role, email: user.email } });
    } catch (e) {}
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    // role check: user.role should exist from `users` table
    if (user.role !== role) return res.status(403).json({ error: 'Insufficient role' });
    return next();
  };
};
