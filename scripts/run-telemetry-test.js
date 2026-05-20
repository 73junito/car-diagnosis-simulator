const assert = require('assert');
const EventEmitter = require('events');
const { createSseHandler } = require('../api/telemetry/stream');

async function run() {
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

  assert.strictEqual(res.headers['Content-Type'], 'text/event-stream');

  emitter.emit('event', { test: 'payload' });

  await new Promise((r) => setTimeout(r, 50));

  const found = res.writes.find(w => w.includes('"test":"payload"'));
  assert.ok(found, 'event data should be written to response');

  req.emit('close');

  console.log('Telemetry test harness passed.');
}

run().catch((err) => {
  console.error('Telemetry test harness failed:', err);
  process.exit(1);
});
