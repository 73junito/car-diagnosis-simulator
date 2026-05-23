const express = require('express');
const storage = require('./storage');

function registerTelemetryHistoryRoute(app) {
  app.get('/api/telemetry/history', async (req, res) => {
    try {
      const sessionId = req.query.session || req.query.sessionId || null;
      let limit = parseInt(req.query.limit, 10);
      if (Number.isNaN(limit) || limit <= 0) limit = 50; // default
      const HARD_MAX = 500;
      if (limit > HARD_MAX) limit = HARD_MAX;

      const { ok, data, error } = await storage.listTelemetryEvents({ sessionId, limit });
      if (!ok) {
        // graceful fallback: return empty list with info
        return res.status(200).json({ ok: false, data: [], message: error && error.message });
      }

      // ensure newest-first ordering expected by clients
      return res.json({ ok: true, data });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { registerTelemetryHistoryRoute };
