const EventEmitter = require('events');
const { createSseHandler } = require('../api/telemetry/stream');

test('SSE handler sets headers and writes event data', (done) => {
  const emitter = new EventEmitter();
  const handler = createSseHandler(emitter);

  const res = {
    headers: {},
    writes: [],
    setHeader(k, v) { this.headers[k] = v; },
    write(chunk) { this.writes.push(String(chunk)); },
  };

  const req = new EventEmitter();
  req.on('close', () => {});

  handler(req, res);

  expect(res.headers['Content-Type']).toBe('text/event-stream');

  emitter.emit('event', { test: 'payload' });

  setTimeout(() => {
    const found = res.writes.find(w => w.includes('"test":"payload"'));
    expect(found).toBeTruthy();
    req.emit('close');
    done();
  }, 20);
});
