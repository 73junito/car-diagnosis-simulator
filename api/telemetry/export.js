const express = require('express');
const storage = require('./storage');

function serializeCsvRow(ev){
  // Ensure commas/quotes are escaped
  const esc = (s) => {
    if (s === null || typeof s === 'undefined') return '';
    const str = typeof s === 'string' ? s : JSON.stringify(s);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  return [ev.id||'', ev.session_id||ev.session||'', ev.user_id||'', ev.type||ev.event_type||'', ev.source||'', ev.created_at||ev.timestamp||'', JSON.stringify(ev.payload ?? ev.data ?? ev.body ?? {})].map(esc).join(',');
}

function registerTelemetryExportRoutes(app){
  app.get('/api/telemetry/export.json', async (req, res) => {
    try{
      const sessionId = req.query.session || req.query.sessionId || null;
      let limit = parseInt(req.query.limit, 10);
      if (Number.isNaN(limit) || limit <= 0) limit = 50;
      const HARD_MAX = 500;
      if (limit > HARD_MAX) limit = HARD_MAX;

      const { ok, data, error } = await storage.listTelemetryEvents({ sessionId, limit });
      if (!ok) return res.status(200).json({ ok: false, format: 'json', count: 0, events: [], message: error && error.message });
      return res.json({ ok: true, format: 'json', count: Array.isArray(data)?data.length:0, events: data });
    }catch(err){
      return res.status(500).json({ ok: false, format: 'json', count: 0, events: [] });
    }
  });

  app.get('/api/telemetry/export.csv', async (req, res) => {
    try{
      const sessionId = req.query.session || req.query.sessionId || null;
      let limit = parseInt(req.query.limit, 10);
      if (Number.isNaN(limit) || limit <= 0) limit = 50;
      const HARD_MAX = 500;
      if (limit > HARD_MAX) limit = HARD_MAX;

      const { ok, data, error } = await storage.listTelemetryEvents({ sessionId, limit });
      if (!ok) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.status(200).send('id,session_id,user_id,event_type,source,created_at,payload_json\n');
      }

      const header = 'id,session_id,user_id,event_type,source,created_at,payload_json\n';
      const rows = (Array.isArray(data) ? data : []).map(serializeCsvRow).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="telemetry-export.csv"');
      return res.send(header + rows + (rows ? '\n' : ''));
    }catch(err){
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.status(500).send('id,session_id,user_id,event_type,source,created_at,payload_json\n');
    }
  });
}

module.exports = { registerTelemetryExportRoutes };
