describe('supabaseAdapter ingest integration', () => {
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('posts to ingest url when provided', async () => {
    const mockFetch = global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const mockClient = { from: jest.fn() };
    const { createAdapter } = require('../../lib/telemetry/supabaseAdapter');
    const adapter = createAdapter(mockClient, { ingestUrl: 'https://example.local/ingest', flushIntervalMs: 50, flushSize: 1 });

    await adapter.saveEvent({ type: 'ingest-test', payload: { a: 1 } });
    await new Promise(r => setTimeout(r, 100));

    expect(mockFetch).toHaveBeenCalled();
    await adapter.close();
  });
});
