const express = require('express');
const { telemetryEmitter, addTelemetryEvent, getRecentEvents } = require('./events');

const TELEMETRY_EVENT_LIMIT_BYTES = 10 * 1024;
const telemetryEventJson = express.json({
  limit: '10kb',
  verify(req, res, buf) {
    req.telemetryRawBodySize = buf.length;
  },
});

function validateTelemetryEventBody(req, res, next) {
  try {
    // If the telemetry JSON parser never ran we expect the parser
    // to have set `req.telemetryRawBodySize`. If the request was
    // already parsed upstream (e.g. `req._body === true` and
    // `req.body` exists) that's a programmer error in middleware
    // ordering and should be rejected with a distinct 500 code so
    // callers can detect and fix the integration.
    if (typeof req.telemetryRawBodySize !== 'number') {
      if (req._body && req.body && typeof req.body === 'object') {
        return res.status(500).json({ ok: false, error: 'telemetry_parser_required' });
      }
      if (!req.is || !req.is('json')) {
        return res.status(415).json({ ok: false, error: 'unsupported_media_type' });
      }
      return res.status(400).json({ ok: false, error: 'missing_body' });
    }
    if (req.telemetryRawBodySize > TELEMETRY_EVENT_LIMIT_BYTES) {
      return res.status(413).json({ ok: false, error: 'payload_too_large' });
    }
    return next();
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }
}

function parseTelemetryEventBody(req, res, next) {
  return telemetryEventJson(req, res, (err) => {
    if (err) {
      if (err.type === 'entity.too.large') {
        return res.status(413).json({ ok: false, error: 'payload_too_large' });
      }
      return res.status(400).json({ ok: false, error: 'invalid_json' });
    }

    return validateTelemetryEventBody(req, res, next);
  });
}

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

  app.post('/api/telemetry/events', parseTelemetryEventBody, (req, res) => {
    try {
      const json = req.body && typeof req.body === 'object' ? req.body : {};
      const ok = addTelemetryEvent(json);
      if (!ok) return res.status(400).json({ ok: false, error: 'invalid_event' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'invalid_json' });
    }
  });
}

module.exports = { registerTelemetryRoutes, createSseHandler };
