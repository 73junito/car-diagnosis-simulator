// Minimal analytics students API stub
module.exports = function registerStudentsRoutes(app) {
  // GET /api/analytics/students
  app.get('/api/analytics/students', (req, res) => {
    // TODO: implement per-student aggregation and filtering
    res.json({ message: 'students endpoint (stub) - implement student metrics' });
  });
};
