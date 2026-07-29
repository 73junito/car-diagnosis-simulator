const express = require('express');
const telemetry = require('../../lib/telemetry');

const TELEMETRY_EVENT_LIMIT_BYTES = 10 * 1024;
const telemetryEventJson = express.json({
  limit: TELEMETRY_EVENT_LIMIT_BYTES,
  verify(req, res, buf) {
    req.telemetryRawBodySize = buf.length;
  },
});

function validateTelemetryEventBody(req, res, next) {
  try {
    // At this point the JSON parser should have run and set
    // `req.telemetryRawBodySize`. If it's missing that's an
    // integration error; return an explicit server error so callers
    // can detect middleware ordering problems.
    if (typeof req.telemetryRawBodySize !== 'number') {
      return res.status(500).json({ ok: false, error: 'telemetry_parser_required' });
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
  // If the request was already parsed upstream, skip reparsing and
  // enforce the raw-size contract using Content-Length.
  if (req._body && req.body && typeof req.body === 'object') {
    const contentLengthHeader = req.headers && (req.headers['content-length'] || req.headers['Content-Length']);
    const parsedLength = Number(contentLengthHeader);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      return res.status(400).json({ ok: false, error: 'invalid_content_length' });
    }
    req.telemetryRawBodySize = parsedLength;
    return validateTelemetryEventBody(req, res, next);
  }
  // Prefer checking the Content-Type header directly because in tests
  // `req` may be a stream-like object without Express helpers (e.g. `req.is`).
  const contentType = req.headers && (req.headers['content-type'] || req.headers['Content-Type']);
  if (!contentType || !/application\/json/i.test(contentType)) {
    return res.status(415).json({ ok: false, error: 'unsupported_media_type' });
  }
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

function createSseHandler(emitter = telemetry.streamEmitter) {
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
        void e;
      }
    };
    if (emitter && typeof emitter.on === 'function') {
      emitter.on('event', onEvent);
    }
    // replay recent events for new client
    try {
      const recent = (typeof telemetry.getRecentEvents === 'function') ? telemetry.getRecentEvents() : [];
      for (const e of recent) {
        if (e.id) res.write(`id: ${e.id}\n`);
        res.write(`event: telemetry\n`);
        res.write(`data: ${JSON.stringify(e)}\n\n`);
      }
    } catch (e) { void e; }
    const ping = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(ping);
      if (emitter && typeof emitter.removeListener === 'function') {
        emitter.removeListener('event', onEvent);
      }
    });
  };
}

function registerTelemetryRoutes(app, emitter = telemetry.streamEmitter) {
  app.get('/api/telemetry/stream', createSseHandler(emitter));

    app.post('/api/telemetry/events', parseTelemetryEventBody, async (req, res) => {
    try {
      const json = req.body && typeof req.body === 'object' ? req.body : {};
      const result = await telemetry.saveEvent(json);
      if (!result || result.ok === false) return res.status(400).json({ ok: false, error: 'invalid_event' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'invalid_json' });
    }
  });
}

const handler = createSseHandler();

module.exports = handler;
module.exports.registerTelemetryRoutes = registerTelemetryRoutes;
module.exports.createSseHandler = createSseHandler;
module.exports.parseTelemetryEventBody = parseTelemetryEventBody;
module.exports.validateTelemetryEventBody =
  validateTelemetryEventBody;
