// Minimal analytics sessions API stub
module.exports = function registerSessionsRoutes(app) {
  // GET /api/analytics/sessions
  app.get('/api/analytics/sessions', (req, res) => {
    // TODO: implement aggregation of session metrics
    res.json({ message: 'sessions endpoint (stub) - implement aggregation logic' });
  });
};
