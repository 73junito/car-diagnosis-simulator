const storage = require('./storage');

async function historyHandler(req, res) {
  try {
    const query = req.query || {};
    const sessionId = query.session || query.sessionId || null;
    let limit = parseInt(query.limit, 10);

    if (Number.isNaN(limit) || limit <= 0) limit = 50;
    if (limit > 500) limit = 500;

    const { ok, data, error } = await storage.listTelemetryEvents({ sessionId, limit });

    if (!ok) {
      return res.status(200).json({ ok: false, data: [], message: error && error.message });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

function registerTelemetryHistoryRoute(app, middleware) {
  const handlers = [];
  if (typeof middleware === 'function') handlers.push(middleware);
  handlers.push(historyHandler);
  app.get('/api/telemetry/history', ...handlers);
}

module.exports = historyHandler;
module.exports.registerTelemetryHistoryRoute = registerTelemetryHistoryRoute;
