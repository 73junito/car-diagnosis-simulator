const { parse: parseUrl } = require('url');
const path = require('path');

const eventsModule = require(path.join(__dirname, 'telemetry', 'events'));
const storage = require(path.join(__dirname, 'telemetry', 'storage'));

function okJson(res, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(obj));
}

function sendCsv(res, header, rows, filename = 'telemetry-export.csv'){
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.end(header + rows + (rows ? '\n' : ''));
}

async function handleExport(req, res, query) {
  try {
    const sessionId = query.session || query.sessionId || null;
    let limit = parseInt(query.limit, 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 50;
    const HARD_MAX = 500;
    if (limit > HARD_MAX) limit = HARD_MAX;

    const result = await storage.listTelemetryEvents({ sessionId, limit });
    if (!result || result.ok === false) {
      if ((query.format || query.type || '').toLowerCase() === 'csv') {
        return sendCsv(res, 'id,session_id,user_id,event_type,source,created_at,payload_json\n', '', 'telemetry-export.csv');
      }
      return okJson(res, { ok: false, format: 'json', count: 0, events: [] });
    }
    const data = result.data || [];
    const format = (query.format || query.type || '').toLowerCase();
    if (format === 'csv' || req.url.endsWith('.csv')) {
      const esc = (s) => {
        if (s === null || typeof s === 'undefined') return '';
        const str = typeof s === 'string' ? s : JSON.stringify(s);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };
      const rows = data.map(ev => [ev.id||'', ev.session_id||ev.session||'', ev.user_id||'', ev.type||ev.event_type||'', ev.source||'', ev.created_at||ev.timestamp||'', JSON.stringify(ev.payload ?? ev.data ?? ev.body ?? {})].map(esc).join(',')).join('\n');
      return sendCsv(res, 'id,session_id,user_id,event_type,source,created_at,payload_json\n', rows);
    }

    return okJson(res, { ok: true, format: 'json', count: Array.isArray(data) ? data.length : 0, events: data });
  } catch (err) {
    return res.statusCode ? res.statusCode = 500 && okJson(res, { ok: false, format: 'json', count: 0, events: [] }) : okJson(res, { ok: false });
  }
}

function streamSse(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(': connected\n\n');

  const onEvent = (evt) => {
    try {
      const payload = JSON.stringify(evt);
      if (evt.id) res.write(`id: ${evt.id}\n`);
      res.write(`event: telemetry\n`);
      res.write(`data: ${payload}\n\n`);
    } catch (e) { /* swallow */ }
  };

  if (eventsModule && eventsModule.telemetryEmitter && typeof eventsModule.telemetryEmitter.on === 'function') {
    eventsModule.telemetryEmitter.on('event', onEvent);
  }

  // replay recent
  try {
    const recent = typeof eventsModule.getRecentEvents === 'function' ? eventsModule.getRecentEvents() : [];
    for (const e of recent) {
      if (e.id) res.write(`id: ${e.id}\n`);
      res.write(`event: telemetry\n`);
      res.write(`data: ${JSON.stringify(e)}\n\n`);
    }
  } catch (e) { /* swallow */ }

  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => {
    clearInterval(ping);
    if (eventsModule && eventsModule.telemetryEmitter && typeof eventsModule.telemetryEmitter.removeListener === 'function') {
      eventsModule.telemetryEmitter.removeListener('event', onEvent);
    }
  });
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve({});
        const parsed = JSON.parse(raw);
        return resolve(parsed);
      } catch (e) { return reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  try {
    const parsed = parseUrl(req.url || req.originalUrl || '', true);
    const query = parsed.query || {};
    // action precedence: explicit query `action`, path segment, or specific filename
    let action = (query.action || '').toString().toLowerCase() || null;
    const pathname = parsed.pathname || '';
    let m = null;
    if (pathname && pathname.indexOf('/api/telemetry') === 0) {
      const tail = pathname.substr('/api/telemetry'.length).replace(/^\/+/, '');
      m = tail || null;
    }
    if (!action && m) action = String(m.split(new RegExp('[/?]'))[0] || '').toLowerCase() || null;

    // normalize export endpoints by filename
    if (!action) {
      if ((parsed.pathname || '').endsWith('/export.csv')) action = 'export';
      if ((parsed.pathname || '').endsWith('/export.json')) action = 'export';
      if ((parsed.pathname || '').endsWith('/stream')) action = 'stream';
      if ((parsed.pathname || '').endsWith('/events')) action = 'events';
      if ((parsed.pathname || '').endsWith('/history')) action = 'history';
    }

    if (action === 'stream') return streamSse(req, res);

    if (action === 'events') {
      if (req.method !== 'POST') return res.statusCode = 405 && okJson(res, { ok: false, error: 'Method Not Allowed' });
      try {
        const body = await parseJsonBody(req);
        const json = body && typeof body === 'object' ? body : {};
        const added = typeof eventsModule.addTelemetryEvent === 'function' ? eventsModule.addTelemetryEvent(json) : false;
        // best-effort persist
        try { if (storage && typeof storage.saveTelemetryEvent === 'function') storage.saveTelemetryEvent(json); } catch(e) { /* swallow */ }
        if (!added) return okJson(res, { ok: false, error: 'invalid_event' });
        return okJson(res, { ok: true });
      } catch (e) {
        return res.statusCode = 400 && okJson(res, { ok: false, error: 'invalid_json' });
      }
    }

    if (action === 'history') {
      return handleExport(req, res, query); // history uses same storage list shape
    }

    if (action === 'export') {
      return handleExport(req, res, { ...query, format: (query.format || (parsed.pathname && parsed.pathname.endsWith('.csv') ? 'csv' : null)) });
    }

    // default: not found
    res.statusCode = 404;
    return okJson(res, { ok: false, error: 'not_found' });
  } catch (err) {
    res.statusCode = 500;
    return okJson(res, { ok: false, error: 'internal_error' });
  }
};
