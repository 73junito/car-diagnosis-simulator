const EventEmitter = require('events');
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
  // simulate POST handler using the real route logic
  const { registerTelemetryRoutes } = require('../api/telemetry/stream');
  const app = { get() {}, post(path, ...handlers) {
    // get the actual route handler (last argument, after any middleware)
    const h = handlers[handlers.length - 1];
    // simulate request without required fields; body pre-parsed as express.json() would do
    const req = new EventEmitter();
    req.body = { invalid: true };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(obj) { try { expect(this.statusCode).toBe(400); expect(obj.ok).toBe(false); done(); } catch (e) { done(e); } }
    };
    // call handler
    h(req, res);
  } };

  registerTelemetryRoutes(app);
});

test('POST /api/telemetry/events rejects oversized pre-parsed body', (done) => {
  const { registerTelemetryRoutes } = require('../api/telemetry/stream');
  const app = { get() {}, post(path, ...handlers) {
    const middleware = handlers[0];
    const req = new EventEmitter();
    req.body = {
      type: 'telemetry.event',
      timestamp: '2026-05-21T00:00:00.000Z',
      payload: 'x'.repeat(10 * 1024),
    };
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

    middleware(req, res, () => done(new Error('expected oversized payload to be rejected')));
  } };

  registerTelemetryRoutes(app);
});
