const express = require('express');
const request = require('supertest');

jest.mock('../api/telemetry/storage');
const storage = require('../api/telemetry/storage');

const { registerTelemetryExportRoutes } = require('../api/telemetry/export');

describe('Telemetry export endpoints', () => {
  let app;
  beforeEach(()=>{
    app = express();
    registerTelemetryExportRoutes(app);
  });
  afterEach(()=>{ jest.resetAllMocks(); });

  test('JSON export returns events', async ()=>{
    const sample = [{ id:'1', session_id:'s1' }];
    storage.listTelemetryEvents.mockResolvedValue({ ok:true, data: sample });
    const res = await request(app).get('/api/telemetry/export.json').query({ session: 's1', limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.format).toBe('json');
    expect(res.body.count).toBe(1);
    expect(res.body.events).toEqual(sample);
  });

  test('JSON export includes storage error message when unavailable', async ()=>{
    storage.listTelemetryEvents.mockResolvedValue({ ok:false, data: [], error: new Error('Not configured') });
    const res = await request(app).get('/api/telemetry/export.json');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toBe('Not configured');
    expect(res.body.events).toEqual([]);
  });

  test('CSV export returns header even when storage not configured', async ()=>{
    storage.listTelemetryEvents.mockResolvedValue({ ok:false, data: [] });
    const res = await request(app).get('/api/telemetry/export.csv');
    expect(res.status).toBe(200);
    expect(res.text.startsWith('id,session_id,user_id,event_type,source,created_at,payload_json')).toBe(true);
  });

  test('enforces hard max limit', async ()=>{
    storage.listTelemetryEvents.mockResolvedValue({ ok:true, data: [] });
    await request(app).get('/api/telemetry/export.json').query({ limit: 10000 });
    expect(storage.listTelemetryEvents).toHaveBeenCalledWith({ sessionId: null, limit: 500 });
  });
});
