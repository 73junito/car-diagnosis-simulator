const express = require('express');
const request = require('supertest');

jest.mock('../api/telemetry/storage');
const storage = require('../api/telemetry/storage');

const { registerTelemetryHistoryRoute } = require('../api/telemetry/history');

describe('GET /api/telemetry/history', () => {
  let app;

  beforeEach(() => {
    app = express();
    registerTelemetryHistoryRoute(app);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('returns empty data when storage not configured', async () => {
    storage.listTelemetryEvents.mockResolvedValue({ ok: false, data: [], error: new Error('Not configured') });
    const res = await request(app).get('/api/telemetry/history');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('returns events with session filter and limit', async () => {
    const sample = [{ id: '1', session_id: 's1' }];
    storage.listTelemetryEvents.mockResolvedValue({ ok: true, data: sample });
    const res = await request(app).get('/api/telemetry/history').query({ session: 's1', limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual(sample);
    expect(storage.listTelemetryEvents).toHaveBeenCalledWith({ sessionId: 's1', limit: 10 });
  });

  test('enforces hard max limit', async () => {
    const sample = [];
    storage.listTelemetryEvents.mockResolvedValue({ ok: true, data: sample });
    const res = await request(app).get('/api/telemetry/history').query({ limit: 10000 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(storage.listTelemetryEvents).toHaveBeenCalledWith({ sessionId: null, limit: 500 });
  });
});
