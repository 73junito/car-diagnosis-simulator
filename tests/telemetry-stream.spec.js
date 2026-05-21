const EventEmitter = require('events');
const { registerTelemetryRoutes } = require('../api/telemetry/stream');

// Ensure the existing telemetry route tests in `telemetry-stream.test.js`
// are executed under the current Jest `**/tests/**/*.spec.js` pattern.
require('./telemetry-stream.test');

test('POST /api/telemetry/events rejects oversized payloads', (done) => {
  let postHandler;
  const app = {
    get() {},
    post(path, handler) {
      if (path === '/api/telemetry/events') postHandler = handler;
    },
  };

  registerTelemetryRoutes(app);

  const req = new EventEmitter();
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      try {
        expect(this.statusCode).toBe(413);
        expect(obj).toEqual({ ok: false, error: 'payload_too_large' });
        done();
      } catch (e) {
        done(e);
      }
    },
  };

  postHandler(req, res);
  req.emit('data', Buffer.from('x'.repeat(1024 * 1024 + 1)));
  req.emit('end');
});
