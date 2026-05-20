const { telemetryEmitter } = require('./events');

function createSseHandler(emitter = telemetryEmitter) {
  return (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(': connected\n\n');

    const onEvent = (evt) => {
      try {
        const payload = JSON.stringify(evt);
        res.write(`data: ${payload}\n\n`);
      } catch (e) {
        // ignore circular
      }
    };

    emitter.on('event', onEvent);
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
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {};
        emitter.emit('event', json);
        res.json({ ok: true });
      } catch (e) {
        res.status(400).json({ ok: false, error: 'invalid_json' });
      }
    });
  });
}

module.exports = { registerTelemetryRoutes, createSseHandler };
