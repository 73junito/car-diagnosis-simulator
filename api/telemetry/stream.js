const { telemetryEmitter, addTelemetryEvent, getRecentEvents } = require('./events');
const MAX_TELEMETRY_EVENT_BODY_BYTES = 1024 * 1024;

function createSseHandler(emitter = telemetryEmitter) {
  return (req, res) => {
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
      } catch (e) {
        // ignore circular
      }
    };

    emitter.on('event', onEvent);
    // replay recent events for new client
    try {
      const recent = getRecentEvents();
      for (const e of recent) {
        if (e.id) res.write(`id: ${e.id}\n`);
        res.write(`event: telemetry\n`);
        res.write(`data: ${JSON.stringify(e)}\n\n`);
      }
    } catch (e) {}
    const ping = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(ping);
      emitter.removeListener('event', onEvent);
    });
  };
}

function registerTelemetryRoutes(app, emitter = telemetryEmitter) {
  app.get('/api/telemetry/stream', createSseHandler(emitter));

  app.post('/api/telemetry/events', (req, res) => {
    let body = '';
    let bodyBytes = 0;
    let payloadTooLarge = false;
    req.on('data', (c) => {
      if (payloadTooLarge) return;
      const chunk = Buffer.isBuffer(c) ? c : Buffer.from(String(c));
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_TELEMETRY_EVENT_BODY_BYTES) {
        payloadTooLarge = true;
        return res.status(413).json({ ok: false, error: 'payload_too_large' });
      }
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (payloadTooLarge) return;
      try {
        const json = body ? JSON.parse(body) : {};
        const ok = addTelemetryEvent(json);
        if (!ok) return res.status(400).json({ ok: false, error: 'invalid_event' });
        return res.json({ ok: true });
      } catch (e) {
        return res.status(400).json({ ok: false, error: 'invalid_json' });
      }
    });
  });
}

module.exports = { registerTelemetryRoutes, createSseHandler };
