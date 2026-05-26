const storage = require('./storage');

function registerTelemetryHistoryRoute(app, middleware) {
  const handlers = [];
  if (typeof middleware === 'function') handlers.push(middleware);
  handlers.push(async (req, res) => {
    try {
      const sessionId = req.query.session || req.query.sessionId || null;
      let limit = parseInt(req.query.limit, 10);
      if (Number.isNaN(limit) || limit <= 0) limit = 50; // default
      const HARD_MAX = 500;
      if (limit > HARD_MAX) limit = HARD_MAX;

      const { ok, data, error } = await storage.listTelemetryEvents({ sessionId, limit });

      if (!ok) {
        return res.status(200).json({ ok: false, data: [], message: error && error.message });
      }

      return res.json({ ok: true, data });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/telemetry/history', ...handlers);
}

module.exports = { registerTelemetryHistoryRoute };
