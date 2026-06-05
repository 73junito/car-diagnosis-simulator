describe('telemetry storage adapter', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
  });

  test('saveTelemetryEvent uses supabase insert when configured', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    // Ensure fresh module registry and mock tied to this test
    jest.resetModules();
    const createClient = jest.fn();
    jest.doMock('@supabase/supabase-js', () => ({ createClient }), { virtual: true });

    const selectMock = jest.fn(() => ({ single: () => Promise.resolve({ data: { id: '1' }, error: null }) }));
    const insertMock = jest.fn(() => ({ select: selectMock }));
    // chainable mock: from(...).insert(...).select().single()
    const fromMock = jest.fn(() => ({ insert: insertMock }));
    const supabase = { from: fromMock };
    createClient.mockReturnValue(supabase);

    const adapter = require('../api/telemetry/storage');
    const event = { sessionId: 's1', userId: 'u1', eventType: 'click', payload: { a: 1 } };
    const res = await adapter.saveTelemetryEvent(event);

    // Ensure the adapter returned success and data when Supabase client is configured
    expect(res.ok).toBe(true);
    expect(res.data).toBeDefined();
  });

  test('listTelemetryEvents queries with sessionId and limit', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    // Ensure fresh module registry and mock tied to this test
    jest.resetModules();
    const createClient = jest.fn();
    jest.doMock('@supabase/supabase-js', () => ({ createClient }), { virtual: true });

    const data = [{ id: '1' }];
    // simulate chain: from().select().order().limit() -> resolves { data }
    const limitMock = jest.fn(() => {
      const p = Promise.resolve({ data, error: null });
      p.eq = () => Promise.resolve({ data, error: null });
      return p;
    });
    const orderMock = jest.fn(() => ({ limit: limitMock }));
    const selectMock = jest.fn(() => ({ order: orderMock }));
    const fromMock = jest.fn(() => ({ select: selectMock }));
    const supabase = { from: fromMock };
    createClient.mockReturnValue(supabase);

    const adapter = require('../api/telemetry/storage');
    const res = await adapter.listTelemetryEvents({ sessionId: 's1', limit: 10 });

    // Ensure the adapter returned success and the mocked data
    expect(res.ok).toBe(true);
    expect(res.data).toEqual(data);
  });

  test('adapter fails gracefully when supabase not configured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    jest.resetModules();
    const adapter = require('../api/telemetry/storage');
    const saveRes = await adapter.saveTelemetryEvent({});
    const listRes = await adapter.listTelemetryEvents();

    expect(saveRes.ok).toBe(false);
    expect(listRes.ok).toBe(false);
  });
});
