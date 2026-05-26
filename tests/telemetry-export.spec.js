const express = require('express');
const request = require('supertest');

jest.mock('../api/telemetry/storage');
const storage = require('../api/telemetry/storage');

const { registerTelemetryExportRoutes } = require('../api/telemetry/export');

describe('Telemetry export endpoints', () => {
  let app;

  beforeEach(() => {
    app = express();
    registerTelemetryExportRoutes(app);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('JSON export returns telemetry events and count', async () => {
    const sample = [{ id: '1', session_id: 's1' }];
    storage.listTelemetryEvents.mockResolvedValue({ ok: true, data: sample });

    const res = await request(app).get('/api/telemetry/export.json').query({ session: 's1', limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      format: 'json',
      count: 1,
      events: sample
    });
    expect(storage.listTelemetryEvents).toHaveBeenCalledWith({ sessionId: 's1', limit: 10 });
  });

  test('JSON export includes storage error message when unavailable', async () => {
    storage.listTelemetryEvents.mockResolvedValue({ ok: false, data: [], error: new Error('Not configured') });

    const res = await request(app).get('/api/telemetry/export.json');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toBe('Not configured');
    expect(res.body.events).toEqual([]);
  });

  test('JSON export returns 500 when storage throws unexpectedly', async () => {
    storage.listTelemetryEvents.mockRejectedValue(new Error('boom'));

    const res = await request(app).get('/api/telemetry/export.json');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, format: 'json', count: 0, events: [] });
  });

  test('CSV export writes escaped rows and attachment headers', async () => {
    storage.listTelemetryEvents.mockResolvedValue({
      ok: true,
      data: [{
        id: '1',
        session_id: 's,1',
        user_id: 'u"1',
        event_type: 'snapshot',
        source: 'manual',
        created_at: '2026-05-22T00:00:00.000Z',
        payload: { note: 'line1\nline2' }
      }]
    });

    const res = await request(app).get('/api/telemetry/export.csv').query({ sessionId: 'abc', limit: 10000 });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('telemetry-export.csv');
    expect(res.text).toContain('"s,1"');
    expect(res.text).toContain('"u""1"');
    expect(res.text).toContain('"{""note"":""line1\\nline2""}"');
    expect(storage.listTelemetryEvents).toHaveBeenCalledWith({ sessionId: 'abc', limit: 500 });
  });

  test('CSV export returns header on storage failure and thrown errors', async () => {
    storage.listTelemetryEvents.mockResolvedValueOnce({ ok: false, data: [] });
    const graceful = await request(app).get('/api/telemetry/export.csv');

    expect(graceful.status).toBe(200);
    expect(graceful.text).toBe('id,session_id,user_id,event_type,source,created_at,payload_json\n');

    storage.listTelemetryEvents.mockRejectedValueOnce(new Error('unexpected'));
    const errored = await request(app).get('/api/telemetry/export.csv');

    expect(errored.status).toBe(500);
    expect(errored.text).toBe('id,session_id,user_id,event_type,source,created_at,payload_json\n');
  });
});
