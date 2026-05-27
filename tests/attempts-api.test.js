/** @jest-environment node */

describe('Attempts API endpoints (mocked Supabase)', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = Object.assign({}, process.env);
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('save endpoint returns 200 with id on success', async () => {
    // Mock supabase client
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'abc-123' }, error: null }) }) })
        }),
      }),
    }));

    const save = require('../api/attempts/save');

    const req = { method: 'POST', body: { scenario: 'no-start', workflow_type: 'student' } };
    const res = { statusCode: 200, body: null, status(code){ this.statusCode = code; return this; }, json(obj){ this.body = obj; } };

    await save(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('id', 'abc-123');
  });

  test('load endpoint returns attempt when present', async () => {
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            eq: function(){ return this; },
            order: function(){ return this; },
            limit: function(){ return Promise.resolve({ data: [{ id: 'abc-123', scenario: 'no-start' }], error: null }); }
          })
        }),
      }),
    }));

    const load = require('../api/attempts/load');
    const req = { method: 'GET', query: { scenario: 'no-start' } };
    const res = { statusCode: 200, body: null, status(code){ this.statusCode = code; return this; }, json(obj){ this.body = obj; } };

    await load(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('attempt');
    expect(res.body.attempt).toHaveProperty('id', 'abc-123');
  });

});
