const express = require('express');
const request = require('supertest');

jest.mock('../api/telemetry/storage');
jest.mock('../api/telemetry/events', () => {
  const EventEmitter = require('events');
  const emitter = new EventEmitter();
  return {
    telemetryEmitter: emitter,
    addTelemetryEvent: jest.fn(() => true),
    getRecentEvents: jest.fn(() => []),
  };
});

const storage = require('../api/telemetry/storage');
const eventsModule = require('../api/telemetry/events');
const handler = require('../api/telemetry');

describe('Consolidated /api/telemetry handler', () => {
  let app;

  beforeEach(() => {
    app = express();
    // mount the consolidated handler at root so requests to /api/telemetry hit it
    app.use((req, res, next) => {
      // ensure express will populate req.url and body for our handler
      next();
    });
    app.all('/api/telemetry', handler);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('GET /api/telemetry?action=history returns events list', async () => {
    const sample = [{ id: 'h1', session_id: 's1' }];
    storage.listTelemetryEvents.mockResolvedValue({ ok: true, data: sample });

    const res = await request(app).get('/api/telemetry').query({ action: 'history', session: 's1', limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.format).toBe('json');
    expect(res.body.count).toBe(1);
    expect(res.body.events).toEqual(sample);
    expect(storage.listTelemetryEvents).toHaveBeenCalledWith({ sessionId: 's1', limit: 10 });
  });

  test('GET /api/telemetry?action=export returns JSON export', async () => {
    const sample = [{ id: 'e1' }];
    storage.listTelemetryEvents.mockResolvedValue({ ok: true, data: sample });

    const res = await request(app).get('/api/telemetry').query({ action: 'export', format: 'json' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.format).toBe('json');
    expect(res.body.events).toEqual(sample);
  });

  test('GET /api/telemetry?action=export&format=csv returns CSV', async () => {
    storage.listTelemetryEvents.mockResolvedValue({ ok: true, data: [{ id: 'c1', session_id: 's,1', user_id: 'u"1', payload: { x: 1 } }] });

    const res = await request(app).get('/api/telemetry').query({ action: 'export', format: 'csv' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('telemetry-export.csv');
    expect(res.text).toContain('id,session_id,user_id');
  });

  test('POST /api/telemetry?action=events accepts valid event', async () => {
    eventsModule.addTelemetryEvent.mockReturnValue(true);
    storage.saveTelemetryEvent.mockResolvedValue({ ok: true });

    const payload = { type: 'test', timestamp: new Date().toISOString() };
    const res = await request(app).post('/api/telemetry?action=events').send(payload).set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(eventsModule.addTelemetryEvent).toHaveBeenCalled();
  });

  test('GET /api/telemetry?action=stream sets SSE headers and streams events', (done) => {
    const req = { url: '/api/telemetry?action=stream', on: () => {}, method: 'GET' };
    const res = { headers: {}, writes: [], setHeader(k, v) { this.headers[k] = v; }, write(chunk) { this.writes.push(String(chunk)); }, end() {} };

    handler(req, res).then(() => {
      // handler returned (shouldn't normally), but test will continue
    }).catch(() => {});

    // emit an event and verify it was written
    eventsModule.telemetryEmitter.emit('event', { id: 'evt-1', test: 'payload' });

    setTimeout(() => {
      try {
        expect(res.headers['Content-Type']).toBe('text/event-stream');
        const hasEvent = res.writes.some(w => w.includes('event: telemetry'));
        const hasData = res.writes.some(w => w.includes('"test":"payload"'));
        expect(hasEvent).toBeTruthy();
        expect(hasData).toBeTruthy();
        done();
      } catch (e) { done(e); }
    }, 20);
  });

  test('GET /api/telemetry?action=invalid returns not_found', async () => {
    const res = await request(app).get('/api/telemetry').query({ action: 'invalid' });
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });
});
