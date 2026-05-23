const EventEmitter = require('events');
const { Readable } = require('stream');
const { createSseHandler } = require('../api/telemetry/stream');

test('SSE handler sets headers and writes event data including id and event', (done) => {
  const emitter = new EventEmitter();
  const handler = createSseHandler(emitter);

  const res = {
    headers: {},
    writes: [],
    setHeader(k, v) { this.headers[k] = v; },
    write(chunk) { this.writes.push(String(chunk)); },
  };

  const req = new EventEmitter();

  handler(req, res);

  expect(res.headers['Content-Type']).toBe('text/event-stream');

  emitter.emit('event', { id: 'evt-1', test: 'payload' });

  setTimeout(() => {
    const hasId = res.writes.some(w => w.startsWith('id:'));
    const hasEvent = res.writes.some(w => w.startsWith('event:'));
    const hasData = res.writes.some(w => w.includes('"test":"payload"'));
    expect(hasId).toBeTruthy();
    expect(hasEvent).toBeTruthy();
    expect(hasData).toBeTruthy();
    req.emit('close');
    done();
  }, 20);
});

test('POST /api/telemetry/events rejects invalid event', (done) => {
  // simulate POST route using the registered middleware chain
  const { registerTelemetryRoutes } = require('../api/telemetry/stream');
  const app = { get() {}, post(path, ...handlers) {
    // simulate request without required fields and let express.json() parse it
    const rawBody = JSON.stringify({ invalid: true });
    const req = Readable.from([Buffer.from(rawBody)]);
    req.headers = {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(rawBody)),
    };
    req.method = 'POST';
    req.url = '/api/telemetry/events';
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(obj) { try { expect(this.statusCode).toBe(400); expect(obj.ok).toBe(false); done(); } catch (e) { done(e); } }
    };
    const runHandler = (index) => {
      const handler = handlers[index];
      if (!handler) return;
      if (handler.length >= 3) {
        handler(req, res, (err) => {
          if (err) return done(err);
          return runHandler(index + 1);
        });
        return;
      }
      handler(req, res);
    };

    runHandler(0);
  } };

  registerTelemetryRoutes(app);
});

test('POST /api/telemetry/events rejects oversized payload with 413 payload_too_large', (done) => {
  const { registerTelemetryRoutes } = require('../api/telemetry/stream');
  const app = { get() {}, post(path, ...handlers) {
    const oversizedBody = {
      type: 'telemetry.event',
      timestamp: '2026-05-22T00:00:00.000Z',
      payload: 'x'.repeat((10 * 1024) + 1),
    };
    const rawBody = JSON.stringify(oversizedBody);
    const req = Readable.from([Buffer.from(rawBody)]);
    req.headers = {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(rawBody)),
    };
    req.method = 'POST';
    req.url = '/api/telemetry/events';
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(obj) {
        try {
          expect(this.statusCode).toBe(413);
          expect(obj.ok).toBe(false);
          expect(obj.error).toBe('payload_too_large');
          done();
        } catch (e) {
          done(e);
        }
      }
    };
    const runHandler = (index) => {
      const handler = handlers[index];
      if (!handler) return;
      if (handler.length >= 3) {
        handler(req, res, (err) => {
          if (err) return done(err);
          return runHandler(index + 1);
        });
        return;
      }
      handler(req, res);
    };

    runHandler(0);
  } };

  registerTelemetryRoutes(app);
});

test('POST /api/telemetry/events accepts pre-parsed body and enforces size from content-length', (done) => {
  const { registerTelemetryRoutes } = require('../api/telemetry/stream');
  const app = { get() {}, post(path, ...handlers) {
    const finalHandler = handlers[handlers.length - 1];
    const req = new EventEmitter();
    const body = {
      type: 'telemetry.event',
      timestamp: '2026-05-21T00:00:00.000Z',
      payload: 'x',
    };
    req.body = body;
    req._body = true; // simulate upstream express.json() already parsed this request
    req.headers = {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(JSON.stringify(body))),
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(obj) {
        try {
          expect(this.statusCode).toBe(200);
          expect(obj.ok).toBe(true);
          done();
        } catch (e) {
          done(e);
        }
      }
    };

    const runHandler = (index) => {
      const handler = handlers[index];
      if (!handler) return;
      if (handler.length >= 3) {
        handler(req, res, (err) => {
          if (err) return done(err);
          return runHandler(index + 1);
        });
        return;
      }
      finalHandler(req, res);
    };

    runHandler(0);
  } };

  registerTelemetryRoutes(app);
});
