const { createAdapter } = require('../../lib/telemetry/supabaseAdapter');

jest.useRealTimers();

describe('supabaseAdapter', () => {
  test('flushes a single event when flushSize=1', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
    const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });
    const mockClient = { from: mockFrom };

    const adapter = createAdapter(mockClient, { flushIntervalMs: 50, flushSize: 1, retryBaseMs: 10, maxRetries: 1 });

    await adapter.saveEvent({ type: 'test', payload: { a: 1 } });
    // give event loop a tick to allow immediate flush to run
    await new Promise(r => setTimeout(r, 100));

    expect(mockFrom).toHaveBeenCalledWith('telemetry_events');
    expect(mockInsert).toHaveBeenCalled();
    await adapter.close();
  });

  test('retries on transient insert error then succeeds', async () => {
    let calls = 0;
    const mockInsert = jest.fn().mockImplementation(() => {
      calls += 1;
      if (calls < 2) return Promise.resolve({ data: null, error: { message: 'transient' } });
      return Promise.resolve({ data: [{ id: 'ok' }], error: null });
    });
    const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });
    const mockClient = { from: mockFrom };

    const adapter = createAdapter(mockClient, { flushIntervalMs: 50, flushSize: 1, retryBaseMs: 1, maxRetries: 3 });
    await adapter.saveEvent({ type: 'retry-test', payload: { foo: 'bar' } });
    await new Promise(r => setTimeout(r, 200));

    expect(mockInsert.mock.calls.length).toBeGreaterThanOrEqual(2);
    await adapter.close();
  });

  test('recordSessionStep inserts into session_history', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
    const mockFrom = jest.fn().mockImplementation((table) => {
      if (table === 'session_history') return { insert: mockInsert };
      return { insert: jest.fn().mockResolvedValue({ data: [], error: null }) };
    });
    const mockClient = { from: mockFrom };
    const adapter = createAdapter(mockClient, { flushIntervalMs: 1000, flushSize: 100 });

    const res = await adapter.recordSessionStep({ session_id: 's1', step: 1, event: { ok: true } });
    expect(mockFrom).toHaveBeenCalledWith('session_history');
    expect(mockInsert).toHaveBeenCalled();
    void res;
    await adapter.close();
  });
});
