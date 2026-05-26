function setStorageEnv(env = {}) {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  Object.assign(process.env, env);
}

function loadStorage({ env = {}, client } = {}) {
  jest.resetModules();
  setStorageEnv(env);

  const createClientMock = jest.fn();
  if (client) createClientMock.mockReturnValue(client);

  jest.doMock('@supabase/supabase-js', () => ({
    createClient: createClientMock
  }), { virtual: true });

  const adapter = require('../api/telemetry/storage');
  return { adapter, createClientMock };
}

describe('telemetry storage adapter', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    setStorageEnv();
  });

  test('saveTelemetryEvent maps fields and inserts row when configured', async () => {
    const singleMock = jest.fn().mockResolvedValue({ data: { id: 'row-1' }, error: null });
    const selectMock = jest.fn(() => ({ single: singleMock }));
    const insertMock = jest.fn(() => ({ select: selectMock }));
    const fromMock = jest.fn(() => ({ insert: insertMock }));

    const { adapter, createClientMock } = loadStorage({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key'
      },
      client: { from: fromMock }
    });

    const result = await adapter.saveTelemetryEvent({
      sessionId: 's-1',
      userId: 'u-1',
      eventType: 'sensor',
      payload: { rpm: 2100 }
    });

    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'service-key');
    expect(insertMock).toHaveBeenCalledWith({
      session_id: 's-1',
      user_id: 'u-1',
      event_type: 'sensor',
      payload_json: { rpm: 2100 },
      source: 'telemetry'
    });
    expect(result).toEqual({ ok: true, data: { id: 'row-1' } });
  });

  test('saveTelemetryEvent returns storage error when insert fails', async () => {
    const dbError = new Error('insert failed');
    const fromMock = jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null, error: dbError })
        }))
      }))
    }));

    const { adapter } = loadStorage({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key'
      },
      client: { from: fromMock }
    });

    const result = await adapter.saveTelemetryEvent({ eventType: 'sensor' });

    expect(result).toEqual({ ok: false, error: dbError, data: null });
  });

  test('listTelemetryEvents applies limit and session filter when provided', async () => {
    const data = [{ id: 'evt-1', session_id: 'sess-1' }];
    const eqMock = jest.fn().mockResolvedValue({ data, error: null });
    const limitMock = jest.fn(() => ({ eq: eqMock }));
    const orderMock = jest.fn(() => ({ limit: limitMock }));
    const selectMock = jest.fn(() => ({ order: orderMock }));
    const fromMock = jest.fn(() => ({ select: selectMock }));

    const { adapter, createClientMock } = loadStorage({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key'
      },
      client: { from: fromMock }
    });

    const result = await adapter.listTelemetryEvents({ sessionId: 'sess-1', limit: 10 });

    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key');
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(10);
    expect(eqMock).toHaveBeenCalledWith('session_id', 'sess-1');
    expect(result).toEqual({ ok: true, data });
  });

  test('listTelemetryEvents returns data without session filter', async () => {
    const data = [{ id: 'evt-2' }];
    const limitMock = jest.fn().mockResolvedValue({ data, error: null });
    const orderMock = jest.fn(() => ({ limit: limitMock }));
    const selectMock = jest.fn(() => ({ order: orderMock }));
    const fromMock = jest.fn(() => ({ select: selectMock }));

    const { adapter } = loadStorage({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key'
      },
      client: { from: fromMock }
    });

    const result = await adapter.listTelemetryEvents({ limit: 5 });

    expect(limitMock).toHaveBeenCalledWith(5);
    expect(result).toEqual({ ok: true, data });
  });

  test('listTelemetryEvents surfaces storage errors', async () => {
    const dbError = new Error('read failed');
    const limitMock = jest.fn().mockResolvedValue({ data: null, error: dbError });
    const orderMock = jest.fn(() => ({ limit: limitMock }));
    const selectMock = jest.fn(() => ({ order: orderMock }));
    const fromMock = jest.fn(() => ({ select: selectMock }));

    const { adapter } = loadStorage({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key'
      },
      client: { from: fromMock }
    });

    const result = await adapter.listTelemetryEvents({ limit: 2 });

    expect(result).toEqual({ ok: false, error: dbError, data: [] });
  });

  test('adapter fails gracefully when supabase is not configured', async () => {
    const { adapter } = loadStorage();

    const saveResult = await adapter.saveTelemetryEvent({});
    const listResult = await adapter.listTelemetryEvents();

    expect(saveResult.ok).toBe(false);
    expect(saveResult.error).toBeInstanceOf(Error);
    expect(listResult.ok).toBe(false);
    expect(listResult.data).toEqual([]);
  });
});
